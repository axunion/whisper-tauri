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
        id: "large-v3-turbo",
        name: "Large v3 Turbo",
        size: "1.6GB",
        sizeBytes: 1_739_587_584,
        description:
          "Recommended. High quality and fast, excellent Japanese accuracy",
        downloaded: true,
        bundled: false,
        recommended: true,
        speedNote: "~5-15s/min",
      };

      expect(model.id).toBe("large-v3-turbo");
      expect(model.name).toBe("Large v3 Turbo");
      expect(model.size).toBe("1.6GB");
      expect(model.sizeBytes).toBe(1_739_587_584);
      expect(model.description).toBe(
        "Recommended. High quality and fast, excellent Japanese accuracy",
      );
      expect(model.downloaded).toBe(true);
      expect(model.bundled).toBe(false);
      expect(model.recommended).toBe(true);
      expect(model.speedNote).toBe("~5-15s/min");
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
        recommended: false,
        speedNote: "~2-5s/min",
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
        recommended: false,
        speedNote: "",
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

    it("should allow optional currentSegment", () => {
      const progressWithSegment: TranscriptionProgress = {
        taskId: "task-123",
        progress: 75,
        elapsedMs: 2000,
        currentSegment: "Processing audio...",
      };

      expect(progressWithSegment.currentSegment).toBe("Processing audio...");

      const progressWithoutSegment: TranscriptionProgress = {
        taskId: "task-123",
        progress: 25,
        elapsedMs: 500,
      };

      expect(progressWithoutSegment.currentSegment).toBeUndefined();
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
