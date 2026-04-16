import { describe, expect, it } from "vitest";
import type {
  DownloadProgress,
  FileInfo,
  ModelInfo,
  TranscriptionProgress,
  TranscriptionResult,
  TranscriptionSegment,
} from "../whisper";

describe("Whisper Types", () => {
  describe("ModelInfo", () => {
    it("should have required properties", () => {
      const model: ModelInfo = {
        id: "large-v3",
        name: "Large v3",
        size: "2.9GB",
        sizeBytes: 3_095_033_483,
        description: "High transcription accuracy",
        downloaded: true,
        bundled: false,
        speedSecondsPerMinuteLow: 5.0,
        speedSecondsPerMinuteHigh: 15.0,
      };

      expect(model.id).toBe("large-v3");
      expect(model.name).toBe("Large v3");
      expect(model.size).toBe("2.9GB");
      expect(model.sizeBytes).toBe(3_095_033_483);
      expect(model.description).toBe("High transcription accuracy");
      expect(model.downloaded).toBe(true);
      expect(model.bundled).toBe(false);
    });

    it("should allow optional path property", () => {
      const modelWithPath: ModelInfo = {
        id: "small",
        name: "Small",
        size: "466MB",
        sizeBytes: 488636416,
        description: "Small model",
        downloaded: true,
        bundled: false,
        speedSecondsPerMinuteLow: 2.0,
        speedSecondsPerMinuteHigh: 5.0,
        path: "/path/to/model.bin",
      };

      expect(modelWithPath.path).toBe("/path/to/model.bin");

      const modelWithoutPath: ModelInfo = {
        id: "small",
        name: "Small",
        size: "466MB",
        sizeBytes: 488636416,
        description: "Small model",
        downloaded: false,
        bundled: false,
        speedSecondsPerMinuteLow: 0,
        speedSecondsPerMinuteHigh: 0,
      };

      expect(modelWithoutPath.path).toBeUndefined();
    });
  });

  describe("TranscriptionSegment", () => {
    it("should have timing information", () => {
      const segment: TranscriptionSegment = {
        start: 0,
        end: 5000,
        text: "Hello, world!",
      };

      expect(segment.start).toBe(0);
      expect(segment.end).toBe(5000);
      expect(segment.text).toBe("Hello, world!");
    });
  });

  describe("TranscriptionResult", () => {
    it("should have segments array", () => {
      const result: TranscriptionResult = {
        taskId: "task-123",
        text: "Hello, world! How are you?",
        segments: [
          { start: 0, end: 2000, text: "Hello, world!" },
          { start: 2000, end: 4000, text: "How are you?" },
        ],
        language: "en",
        duration: 4000,
      };

      expect(result.taskId).toBe("task-123");
      expect(result.text).toBe("Hello, world! How are you?");
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]?.start).toBe(0);
      expect(result.segments[1]?.text).toBe("How are you?");
      expect(result.language).toBe("en");
      expect(result.duration).toBe(4000);
    });
  });

  describe("TranscriptionProgress", () => {
    it("should have required properties", () => {
      const progress: TranscriptionProgress = {
        taskId: "task-123",
        progress: 50,
        elapsedMs: 1500,
      };

      expect(progress.taskId).toBe("task-123");
      expect(progress.progress).toBe(50);
      expect(progress.elapsedMs).toBe(1500);
    });
  });

  describe("DownloadProgress", () => {
    it("should have download information", () => {
      const progress: DownloadProgress = {
        modelId: "base",
        downloadedBytes: 50000000,
        totalBytes: 148897792,
        progress: 33.6,
      };

      expect(progress.modelId).toBe("base");
      expect(progress.downloadedBytes).toBe(50000000);
      expect(progress.totalBytes).toBe(148897792);
      expect(progress.progress).toBe(33.6);
    });
  });

  describe("FileInfo", () => {
    it("should have required properties", () => {
      const file: FileInfo = {
        path: "/path/to/audio.wav",
        name: "audio.wav",
        size: 1024000,
      };

      expect(file.path).toBe("/path/to/audio.wav");
      expect(file.name).toBe("audio.wav");
      expect(file.size).toBe(1024000);
    });

    it("should allow optional duration", () => {
      const fileWithDuration: FileInfo = {
        path: "/path/to/audio.wav",
        name: "audio.wav",
        size: 1024000,
        duration: 60000,
      };

      expect(fileWithDuration.duration).toBe(60000);

      const fileWithoutDuration: FileInfo = {
        path: "/path/to/audio.wav",
        name: "audio.wav",
        size: 1024000,
      };

      expect(fileWithoutDuration.duration).toBeUndefined();
    });
  });
});
