import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotionPagePayload, NotionPageRef } from "~/types";
import { createNotionShare } from "../createNotionShare";

const payload: NotionPagePayload = {
  title: "Meeting notes",
  meta: [{ label: "Date", value: "2026-07-07" }],
  summary: null,
  bodyText: "Body text",
};

const pageRef: NotionPageRef = {
  pageId: "page-1",
  url: "https://www.notion.so/page-1",
  partial: false,
};

describe("createNotionShare", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  describe("initial state", () => {
    it("should start in idle state", () => {
      createRoot((dispose) => {
        const share = createNotionShare();
        expect(share.state()).toEqual({ kind: "idle" });
        dispose();
      });
    });
  });

  describe("share", () => {
    it("should return the created page ref and go back to idle on success", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(pageRef);

      await createRoot(async (dispose) => {
        const share = createNotionShare();
        const result = await share.share(payload);

        expect(invoke).toHaveBeenCalledWith("notion_create_page", { payload });
        expect(result).toEqual(pageRef);
        expect(share.state()).toEqual({ kind: "idle" });
        dispose();
      });
    });

    it("should be in sending state while the request is in flight", async () => {
      let resolveShare: (value: NotionPageRef) => void = () => {};
      const sharePromise = new Promise<NotionPageRef>((resolve) => {
        resolveShare = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(sharePromise as Promise<unknown>);

      await createRoot(async (dispose) => {
        const share = createNotionShare();

        const promise = share.share(payload);
        expect(share.state()).toEqual({ kind: "sending" });

        resolveShare(pageRef);
        await promise;

        expect(share.state()).toEqual({ kind: "idle" });
        dispose();
      });
    });

    it("should return null and expose a network error when the Notion API fails", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        "Notion API error (401): unauthorized",
      );

      await createRoot(async (dispose) => {
        const share = createNotionShare();
        const result = await share.share(payload);

        expect(result).toBeNull();
        expect(share.state()).toEqual({
          kind: "error",
          messageKey: "errors.networkError",
          details: "Notion API error (401): unauthorized",
        });
        dispose();
      });
    });

    it("should map an unconfigured integration to an unknown error with details", async () => {
      vi.mocked(invoke).mockRejectedValueOnce("Notion is not configured");

      await createRoot(async (dispose) => {
        const share = createNotionShare();
        const result = await share.share(payload);

        expect(result).toBeNull();
        expect(share.state()).toEqual({
          kind: "error",
          messageKey: "errors.unknownError",
          details: "Notion is not configured",
        });
        dispose();
      });
    });

    it("should omit details when the failure carries no message", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(null);

      await createRoot(async (dispose) => {
        const share = createNotionShare();
        const result = await share.share(payload);

        expect(result).toBeNull();
        expect(share.state()).toEqual({
          kind: "error",
          messageKey: "errors.unknownError",
        });
        dispose();
      });
    });

    it("should recover to idle when a retry after an error succeeds", async () => {
      vi.mocked(invoke)
        .mockRejectedValueOnce("HTTP error: status 500")
        .mockResolvedValueOnce(pageRef);

      await createRoot(async (dispose) => {
        const share = createNotionShare();

        await share.share(payload);
        expect(share.state()).toEqual({
          kind: "error",
          messageKey: "errors.networkError",
          details: "HTTP error: status 500",
        });

        const result = await share.share(payload);
        expect(result).toEqual(pageRef);
        expect(share.state()).toEqual({ kind: "idle" });
        dispose();
      });
    });
  });

  describe("reset", () => {
    it("should clear an error state back to idle", async () => {
      vi.mocked(invoke).mockRejectedValueOnce("HTTP error: status 500");

      await createRoot(async (dispose) => {
        const share = createNotionShare();

        await share.share(payload);
        expect(share.state().kind).toBe("error");

        share.reset();
        expect(share.state()).toEqual({ kind: "idle" });
        dispose();
      });
    });
  });
});
