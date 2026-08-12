import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotionDatabaseInfo, NotionSettings } from "~/types";

// createNotionSettings holds module-level singleton state without a test
// reset hook, so each test re-imports a fresh module instance to stay
// self-contained. The @tauri-apps/api/core mock survives vi.resetModules().
async function freshNotionSettings() {
  vi.resetModules();
  const { createNotionSettings } = await import("../createNotionSettings");
  return createNotionSettings();
}

const fetchedSettings: NotionSettings = {
  enabled: true,
  token: "secret-token",
  databaseId: "db-1",
  titleProperty: "Name",
};

const databaseInfo: NotionDatabaseInfo = {
  id: "db-1",
  title: "Notes",
  titleProperty: "Name",
};

describe("createNotionSettings", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  describe("initial state", () => {
    it("should start with disabled defaults and isLoaded false", async () => {
      const notion = await freshNotionSettings();

      expect(notion.settings()).toEqual({
        enabled: false,
        token: null,
        databaseId: null,
        titleProperty: null,
      });
      expect(notion.isLoaded()).toBe(false);
      expect(notion.isConfigured()).toBe(false);
    });
  });

  describe("load", () => {
    it("should apply fetched settings and set isLoaded", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockResolvedValueOnce(fetchedSettings);

      await notion.load();

      expect(invoke).toHaveBeenCalledWith("notion_get_settings");
      expect(notion.settings()).toEqual(fetchedSettings);
      expect(notion.isLoaded()).toBe(true);
    });

    it("should record the error and stay retryable when the fetch fails", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockRejectedValueOnce("Store error: unreadable");

      // Must not reject: callers fire this without awaiting.
      await expect(notion.load()).resolves.toBeUndefined();
      expect(notion.error()).not.toBeNull();
      expect(notion.isLoaded()).toBe(false);

      // A failed load must not latch — the next call retries and succeeds.
      vi.mocked(invoke).mockResolvedValueOnce(fetchedSettings);
      await notion.load();

      expect(notion.settings()).toEqual(fetchedSettings);
      expect(notion.isLoaded()).toBe(true);
    });

    it("should keep the first loaded settings when load is called again", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke)
        .mockResolvedValueOnce(fetchedSettings)
        .mockResolvedValueOnce({ ...fetchedSettings, token: "other-token" });

      await notion.load();
      await notion.load();

      expect(notion.settings()).toEqual(fetchedSettings);
    });

    it("should share a single fetch across concurrent load calls", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke)
        .mockResolvedValueOnce(fetchedSettings)
        .mockResolvedValueOnce({ ...fetchedSettings, token: "other-token" });

      await Promise.all([notion.load(), notion.load()]);

      expect(notion.settings()).toEqual(fetchedSettings);
      expect(notion.isLoaded()).toBe(true);
    });
  });

  describe("update", () => {
    it("should merge a partial update into settings and persist the result", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await notion.update({ enabled: true, token: "secret-token" });

      const merged: NotionSettings = {
        enabled: true,
        token: "secret-token",
        databaseId: null,
        titleProperty: null,
      };
      expect(notion.settings()).toEqual(merged);
      expect(invoke).toHaveBeenCalledWith("notion_set_settings", {
        settings: merged,
      });
    });

    it("should report failure and keep the optimistic local value when persisting fails", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockRejectedValueOnce("Store error: disk full");

      await expect(notion.update({ enabled: true })).resolves.toBe(false);

      expect(notion.enabled()).toBe(true);
      expect(notion.error()).not.toBeNull();
    });
  });

  describe("testConnection", () => {
    it("should return database info and store the title property", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockResolvedValueOnce(databaseInfo);

      const info = await notion.testConnection("secret-token", "db-1");

      expect(invoke).toHaveBeenCalledWith("notion_test_connection", {
        token: "secret-token",
        databaseId: "db-1",
      });
      expect(info).toEqual(databaseInfo);
      expect(notion.titleProperty()).toBe("Name");
    });

    it("should reject and leave the title property unchanged on failure", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockRejectedValueOnce(
        "Notion API error (401): unauthorized",
      );

      await expect(notion.testConnection("bad-token", "db-1")).rejects.toBe(
        "Notion API error (401): unauthorized",
      );

      expect(notion.titleProperty()).toBeNull();
    });
  });

  describe("derived accessors", () => {
    it("should expose the loaded settings fields", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockResolvedValueOnce(fetchedSettings);

      await notion.load();

      expect(notion.enabled()).toBe(true);
      expect(notion.token()).toBe("secret-token");
      expect(notion.databaseId()).toBe("db-1");
      expect(notion.titleProperty()).toBe("Name");
    });

    it("should be configured only when enabled and all connection fields are set", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await notion.update({
        enabled: true,
        token: "secret-token",
        databaseId: "db-1",
      });
      expect(notion.isConfigured()).toBe(false); // titleProperty still missing

      await notion.update({ titleProperty: "Name" });
      expect(notion.isConfigured()).toBe(true);
    });

    it("should not be configured while the integration is disabled", async () => {
      const notion = await freshNotionSettings();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await notion.update({
        enabled: false,
        token: "secret-token",
        databaseId: "db-1",
        titleProperty: "Name",
      });

      expect(notion.isConfigured()).toBe(false);
    });
  });
});
