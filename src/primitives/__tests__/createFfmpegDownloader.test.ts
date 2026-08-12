import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { FfmpegDownloadProgress } from "~/types";
import {
  _resetFfmpegDownloaderForTesting,
  createFfmpegDownloader,
} from "../createFfmpegDownloader";

describe("createFfmpegDownloader", () => {
  beforeEach(() => {
    _resetFfmpegDownloaderForTesting();
    vi.mocked(invoke).mockReset();
  });

  describe("initial state", () => {
    it("should have isBundled as false", () => {
      createRoot((dispose) => {
        const downloader = createFfmpegDownloader();
        expect(downloader.isBundled()).toBe(false);
        dispose();
      });
    });

    it("should have isDownloading as false", () => {
      createRoot((dispose) => {
        const downloader = createFfmpegDownloader();
        expect(downloader.isDownloading()).toBe(false);
        dispose();
      });
    });

    it("should have null downloadProgress", () => {
      createRoot((dispose) => {
        const downloader = createFfmpegDownloader();
        expect(downloader.downloadProgress()).toBeNull();
        dispose();
      });
    });

    it("should have null error", () => {
      createRoot((dispose) => {
        const downloader = createFfmpegDownloader();
        expect(downloader.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("checkStatus", () => {
    it("should set isBundled when bundled", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(true) // check_ffmpeg_bundled
        .mockResolvedValueOnce(false); // check_ffmpeg_needs_update

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.checkStatus();

        expect(invoke).toHaveBeenCalledWith("check_ffmpeg_bundled");
        expect(invoke).toHaveBeenCalledWith("check_ffmpeg_needs_update");
        expect(downloader.isBundled()).toBe(true);
        dispose();
      });
    });

    it("should set isBundled false when not bundled", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(false) // check_ffmpeg_bundled
        .mockResolvedValueOnce(false); // check_ffmpeg_needs_update

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.checkStatus();

        expect(downloader.isBundled()).toBe(false);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Check failed"));

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.checkStatus();

        expect(downloader.error()).toEqual(
          expect.objectContaining({
            code: "UNKNOWN_ERROR",
            details: "Check failed",
          }),
        );
        dispose();
      });
    });
  });

  describe("deleteBundled", () => {
    it("should invoke delete_ffmpeg and set isBundled false", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined); // delete_ffmpeg

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.deleteBundled();

        expect(invoke).toHaveBeenCalledWith("delete_ffmpeg");
        expect(downloader.isBundled()).toBe(false);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Delete failed"));

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.deleteBundled();

        expect(downloader.error()).toEqual(
          expect.objectContaining({
            code: "UNKNOWN_ERROR",
            details: "Delete failed",
          }),
        );
        dispose();
      });
    });
  });

  describe("download", () => {
    it("should invoke download_ffmpeg and set isBundled", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("/path/to/ffmpeg");

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.download();

        expect(invoke).toHaveBeenCalledWith("download_ffmpeg");
        expect(downloader.isBundled()).toBe(true);
        dispose();
      });
    });

    it("should manage isDownloading flag", async () => {
      let resolveDownload: (value: string) => void = () => {};
      const downloadPromise = new Promise<string>((resolve) => {
        resolveDownload = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(
        downloadPromise as Promise<unknown>,
      );

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();

        expect(downloader.isDownloading()).toBe(false);

        const promise = downloader.download();

        expect(downloader.isDownloading()).toBe(true);

        resolveDownload("/path/to/ffmpeg");
        await promise;

        expect(downloader.isDownloading()).toBe(false);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Download failed"));

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();
        await downloader.download();

        expect(downloader.error()).toEqual(
          expect.objectContaining({
            code: "UNKNOWN_ERROR",
            details: "Download failed",
          }),
        );
        expect(downloader.isBundled()).toBe(false);
        dispose();
      });
    });

    it("should not start download if already downloading", async () => {
      let resolveDownload: (value: string) => void = () => {};
      const downloadPromise = new Promise<string>((resolve) => {
        resolveDownload = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(
        downloadPromise as Promise<unknown>,
      );

      await createRoot(async (dispose) => {
        const downloader = createFfmpegDownloader();

        const callsBefore = vi.mocked(invoke).mock.calls.length;

        const promise1 = downloader.download();
        downloader.download(); // Should be ignored

        // Only one new invoke call should have been made
        expect(vi.mocked(invoke).mock.calls.length - callsBefore).toBe(1);

        resolveDownload("/path/to/ffmpeg");
        await promise1;
        dispose();
      });
    });
  });

  describe("event listeners", () => {
    it("should update downloadProgress on ffmpeg:download-progress event", () => {
      const downloader = createFfmpegDownloader();

      // Find the callback registered at module level for "ffmpeg:download-progress"
      const call = vi
        .mocked(listen)
        .mock.calls.find(([event]) => event === "ffmpeg:download-progress");
      const callback = call?.[1] as
        | ((event: { payload: FfmpegDownloadProgress }) => void)
        | undefined;
      expect(callback).toBeDefined();

      const progressData: FfmpegDownloadProgress = {
        downloadedBytes: 50_000_000,
        totalBytes: 100_000_000,
        progress: 50.0,
      };

      callback?.({ payload: progressData });

      expect(downloader.downloadProgress()).toEqual(progressData);
    });

    it("should register listener at module level (singleton)", () => {
      const listenCalls = vi.mocked(listen).mock.calls.map(([event]) => event);
      expect(listenCalls).toContain("ffmpeg:download-progress");
    });
  });
});
