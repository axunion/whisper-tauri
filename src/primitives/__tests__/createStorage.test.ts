import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageStats } from "../../types";
import { _resetRecordingForTesting, createRecording } from "../createRecording";
import { createStorage } from "../createStorage";

const stats = (overrides?: Partial<StorageStats>): StorageStats => ({
  audioCount: 2,
  audioBytes: 2048,
  pendingRecordingCount: 1,
  pendingRecordingBytes: 512,
  ...overrides,
});

describe("createStorage", () => {
  beforeEach(() => {
    _resetRecordingForTesting();
    vi.mocked(invoke).mockReset();
  });

  it("loads the storage stats", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(stats());

    await createRoot(async (dispose) => {
      const storage = createStorage();
      expect(storage.stats()).toBeNull();

      await storage.load();

      expect(invoke).toHaveBeenCalledWith("history_storage_stats", {
        keepPath: null,
      });
      expect(storage.stats()).toEqual(stats());
      dispose();
    });
  });

  it("refreshes the stats after deleting all audio", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined) // delete
      .mockResolvedValueOnce(stats({ audioCount: 0, audioBytes: 0 }));

    await createRoot(async (dispose) => {
      const storage = createStorage();

      const ok = await storage.deleteAllAudio();

      expect(ok).toBe(true);
      expect(invoke).toHaveBeenCalledWith("history_delete_all_audio");
      expect(storage.stats()?.audioCount).toBe(0);
      dispose();
    });
  });

  it("deletes all history through the history command", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(stats({ audioCount: 0, audioBytes: 0 }));

    await createRoot(async (dispose) => {
      const storage = createStorage();

      expect(await storage.deleteAllHistory()).toBe(true);

      expect(invoke).toHaveBeenCalledWith("history_delete_all");
      dispose();
    });
  });

  it("keeps the recording the session still holds when deleting pending ones", async () => {
    const recording = createRecording();
    vi.mocked(invoke).mockResolvedValueOnce(undefined); // start_recording
    await recording.startRecording();
    vi.mocked(invoke).mockResolvedValueOnce({
      tempFilePath: "/recordings/current.wav",
      durationMs: 1000,
      sampleCount: 16000,
    });
    await recording.stopRecording();
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(stats());

    await createRoot(async (dispose) => {
      const storage = createStorage();

      await storage.deletePendingRecordings();

      expect(invoke).toHaveBeenCalledWith("history_delete_pending_recordings", {
        keepPath: "/recordings/current.wav",
      });
      dispose();
    });
  });

  it("reports a failed delete and leaves the stats untouched", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(stats());

    await createRoot(async (dispose) => {
      const storage = createStorage();
      await storage.load();
      vi.mocked(invoke).mockRejectedValueOnce("IO error: permission denied");

      const ok = await storage.deleteAllAudio();

      expect(ok).toBe(false);
      expect(storage.error()).not.toBeNull();
      expect(storage.stats()).toEqual(stats());

      storage.clearError();
      expect(storage.error()).toBeNull();
      dispose();
    });
  });
});
