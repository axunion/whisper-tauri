import { LazyStore } from "@tauri-apps/plugin-store";
import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "~/types";
import { DEFAULT_SETTINGS } from "~/types";
import { _resetSettingsForTesting, createSettings } from "../createSettings";

type MockStoreInstance = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

const getLastStoreInstance = (): MockStoreInstance => {
  const results = vi.mocked(LazyStore).mock.results;
  const last = results[results.length - 1];
  return last?.value as MockStoreInstance;
};

describe("createSettings", () => {
  beforeEach(() => {
    _resetSettingsForTesting();
  });

  describe("initial state", () => {
    it("should have default settings", () => {
      createRoot((dispose) => {
        const settings = createSettings();
        expect(settings.settings()).toEqual(DEFAULT_SETTINGS);
        dispose();
      });
    });

    it("should have isLoaded as false", () => {
      createRoot((dispose) => {
        const settings = createSettings();
        expect(settings.isLoaded()).toBe(false);
        dispose();
      });
    });
  });

  describe("load", () => {
    it("should load settings from store", async () => {
      const saved: AppSettings = {
        language: "en",
        theme: "dark",
        whisperLanguage: "ja",
        onboardingCompleted: true,
      };

      await createRoot(async (dispose) => {
        const settings = createSettings();
        const store = getLastStoreInstance();
        store.get.mockResolvedValueOnce(saved);

        await settings.load();

        expect(store.get).toHaveBeenCalledWith("app_settings");
        expect(settings.settings()).toEqual(saved);
        dispose();
      });
    });

    it("should merge saved settings with defaults", async () => {
      await createRoot(async (dispose) => {
        const settings = createSettings();
        const store = getLastStoreInstance();
        store.get.mockResolvedValueOnce({ language: "en" });

        await settings.load();

        expect(settings.settings()).toEqual({
          ...DEFAULT_SETTINGS,
          language: "en",
        });
        dispose();
      });
    });

    it("should set isLoaded to true after load", async () => {
      await createRoot(async (dispose) => {
        const settings = createSettings();
        const store = getLastStoreInstance();
        store.get.mockResolvedValueOnce(null);

        expect(settings.isLoaded()).toBe(false);

        await settings.load();

        expect(settings.isLoaded()).toBe(true);
        dispose();
      });
    });

    it("should use default settings when store is empty", async () => {
      await createRoot(async (dispose) => {
        const settings = createSettings();
        const store = getLastStoreInstance();
        store.get.mockResolvedValueOnce(null);

        await settings.load();

        expect(settings.settings()).toEqual(DEFAULT_SETTINGS);
        dispose();
      });
    });
  });

  describe("update", () => {
    it("should partially update settings", async () => {
      await createRoot(async (dispose) => {
        const settings = createSettings();
        const store = getLastStoreInstance();
        store.set.mockResolvedValue(undefined);
        store.save.mockResolvedValue(undefined);

        await settings.update({ language: "en" });

        expect(settings.settings()).toEqual({
          ...DEFAULT_SETTINGS,
          language: "en",
        });
        dispose();
      });
    });

    it("should save to store", async () => {
      await createRoot(async (dispose) => {
        const settings = createSettings();
        const store = getLastStoreInstance();
        store.set.mockResolvedValue(undefined);
        store.save.mockResolvedValue(undefined);

        await settings.update({ theme: "dark" });

        expect(store.set).toHaveBeenCalledWith("app_settings", {
          ...DEFAULT_SETTINGS,
          theme: "dark",
        });
        expect(store.save).toHaveBeenCalled();
        dispose();
      });
    });
  });

  describe("derived accessors", () => {
    it("should return language", () => {
      createRoot((dispose) => {
        const settings = createSettings();
        expect(settings.language()).toBe("ja");
        dispose();
      });
    });

    it("should return theme", () => {
      createRoot((dispose) => {
        const settings = createSettings();
        expect(settings.theme()).toBe("system");
        dispose();
      });
    });
  });
});
