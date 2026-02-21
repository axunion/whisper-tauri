import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type {
  DownloadProgress,
  FileInfo,
  ModelInfo,
  TranscriptionProgress,
  TranscriptionResult,
} from "../../types";
import { createWhisper } from "../createWhisper";

const mockModel = (overrides?: Partial<ModelInfo>): ModelInfo => ({
  id: "large-v3-turbo",
  name: "Large v3 Turbo",
  size: "1.6GB",
  sizeBytes: 1_739_587_584,
  description: "Recommended",
  downloaded: true,
  bundled: false,
  recommended: true,
  speedNote: "~5-15s/min",
  path: "/models/ggml-large-v3-turbo.bin",
  ...overrides,
});

const mockFile: FileInfo = {
  path: "/path/to/audio.wav",
  name: "audio.wav",
  size: 1024000,
  duration: 60000,
};

const mockResult: TranscriptionResult = {
  taskId: "task-123",
  text: "Hello, world!",
  segments: [{ start: 0, end: 5000, text: "Hello, world!" }],
  language: "ja",
  duration: 5000,
};

describe("createWhisper", () => {
  describe("initial state", () => {
    it("should have empty models array", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.models()).toEqual([]);
        dispose();
      });
    });

    it("should have null selectedModel", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.selectedModel()).toBeNull();
        dispose();
      });
    });

    it("should have null file", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.file()).toBeNull();
        dispose();
      });
    });

    it("should have null result", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.result()).toBeNull();
        dispose();
      });
    });

    it("should have null error", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.error()).toBeNull();
        dispose();
      });
    });

    it("should have null progress", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.progress()).toBeNull();
        dispose();
      });
    });

    it("should have null downloadProgress", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.downloadProgress()).toBeNull();
        dispose();
      });
    });

    it("should have isProcessing as false", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.isProcessing()).toBe(false);
        dispose();
      });
    });

    it("should have isDownloading as false", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        expect(whisper.isDownloading()).toBe(false);
        dispose();
      });
    });
  });

  describe("loadModels", () => {
    it("should invoke get_available_models", async () => {
      const models = [mockModel()];
      vi.mocked(invoke).mockResolvedValueOnce(models);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(invoke).toHaveBeenCalledWith("get_available_models");
        dispose();
      });
    });

    it("should set models state with result", async () => {
      const models = [
        mockModel(),
        mockModel({ id: "small", name: "Small", downloaded: false }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(models);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(whisper.models()).toEqual(models);
        dispose();
      });
    });

    it("should auto-select recommended downloaded model", async () => {
      const models = [
        mockModel({
          id: "small",
          name: "Small",
          downloaded: true,
          recommended: false,
        }),
        mockModel({
          id: "large-v3-turbo",
          name: "Large v3 Turbo",
          downloaded: true,
          recommended: true,
        }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(models);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(whisper.selectedModel()?.id).toBe("large-v3-turbo");
        dispose();
      });
    });

    it("should auto-select first downloaded model if no recommended", async () => {
      const models = [
        mockModel({
          id: "small",
          name: "Small",
          downloaded: true,
          recommended: false,
        }),
        mockModel({
          id: "medium",
          name: "Medium",
          downloaded: false,
          recommended: false,
        }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(models);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(whisper.selectedModel()?.id).toBe("small");
        dispose();
      });
    });

    it("should not auto-select if no models are downloaded", async () => {
      const models = [mockModel({ id: "small", downloaded: false })];
      vi.mocked(invoke).mockResolvedValueOnce(models);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(whisper.selectedModel()).toBeNull();
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Failed to load models"),
      );

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(whisper.error()).toBe("Failed to load models");
        dispose();
      });
    });
  });

  describe("selectModel", () => {
    it("should select a downloaded model", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        const model = mockModel({ downloaded: true });

        whisper.selectModel(model);

        expect(whisper.selectedModel()).toEqual(model);
        dispose();
      });
    });

    it("should not select an undownloaded model", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();
        const model = mockModel({ downloaded: false });

        whisper.selectModel(model);

        expect(whisper.selectedModel()).toBeNull();
        dispose();
      });
    });
  });

  describe("setFile", () => {
    it("should set file info", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();

        whisper.setFile(mockFile);

        expect(whisper.file()).toEqual(mockFile);
        dispose();
      });
    });
  });

  describe("downloadModel", () => {
    it("should invoke download_model and reload models", async () => {
      const models = [mockModel({ downloaded: true })];
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // download_model
        .mockResolvedValueOnce(models); // get_available_models

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.downloadModel("large-v3-turbo");

        expect(invoke).toHaveBeenCalledWith("download_model", {
          modelId: "large-v3-turbo",
        });
        expect(invoke).toHaveBeenCalledWith("get_available_models");
        expect(whisper.models()).toEqual(models);
        dispose();
      });
    });

    it("should auto-select model after download if none selected", async () => {
      const downloadedModel = mockModel({
        id: "large-v3-turbo",
        downloaded: true,
      });
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // download_model
        .mockResolvedValueOnce([downloadedModel]); // get_available_models

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        expect(whisper.selectedModel()).toBeNull();

        await whisper.downloadModel("large-v3-turbo");

        expect(whisper.selectedModel()).toEqual(downloadedModel);
        dispose();
      });
    });

    it("should not auto-select if a model is already selected", async () => {
      const existingModel = mockModel({ id: "small", name: "Small" });
      const downloadedModel = mockModel({
        id: "large-v3-turbo",
        downloaded: true,
      });
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // download_model
        .mockResolvedValueOnce([existingModel, downloadedModel]); // get_available_models

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        whisper.selectModel(existingModel);

        await whisper.downloadModel("large-v3-turbo");

        expect(whisper.selectedModel()).toEqual(existingModel);
        dispose();
      });
    });

    it("should manage isDownloading flag", async () => {
      let resolveDownload: () => void = () => {};
      const downloadPromise = new Promise<void>((resolve) => {
        resolveDownload = resolve;
      });
      vi.mocked(invoke)
        .mockReturnValueOnce(downloadPromise as Promise<unknown>) // download_model
        .mockResolvedValueOnce([]); // get_available_models

      await createRoot(async (dispose) => {
        const whisper = createWhisper();

        expect(whisper.isDownloading()).toBe(false);

        const promise = whisper.downloadModel("large-v3-turbo");

        expect(whisper.isDownloading()).toBe(true);

        resolveDownload();
        await promise;

        expect(whisper.isDownloading()).toBe(false);
        dispose();
      });
    });
  });

  describe("startTranscription", () => {
    it("should do nothing when file is null", async () => {
      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        whisper.selectModel(mockModel());

        await whisper.startTranscription();

        expect(invoke).not.toHaveBeenCalledWith(
          "transcribe_audio",
          expect.anything(),
        );
        dispose();
      });
    });

    it("should do nothing when model is null", async () => {
      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        whisper.setFile(mockFile);

        await whisper.startTranscription();

        expect(invoke).not.toHaveBeenCalledWith(
          "transcribe_audio",
          expect.anything(),
        );
        dispose();
      });
    });

    it("should invoke transcribe_audio and set result", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        const model = mockModel();
        whisper.selectModel(model);
        whisper.setFile(mockFile);

        await whisper.startTranscription();

        expect(invoke).toHaveBeenCalledWith("transcribe_audio", {
          audioPath: mockFile.path,
          modelPath: model.path,
        });
        expect(whisper.result()).toEqual(mockResult);
        dispose();
      });
    });

    it("should manage isProcessing flag", async () => {
      let resolveTranscribe: (value: TranscriptionResult) => void = () => {};
      const transcribePromise = new Promise<TranscriptionResult>((resolve) => {
        resolveTranscribe = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(
        transcribePromise as Promise<unknown>,
      );

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        whisper.selectModel(mockModel());
        whisper.setFile(mockFile);

        expect(whisper.isProcessing()).toBe(false);

        const promise = whisper.startTranscription();

        expect(whisper.isProcessing()).toBe(true);

        resolveTranscribe(mockResult);
        await promise;

        expect(whisper.isProcessing()).toBe(false);
        dispose();
      });
    });
  });

  describe("cancelTranscription", () => {
    it("should invoke cancel_transcription with task id", async () => {
      // Set up listen mock to capture the callback
      let progressCallback: (event: {
        payload: TranscriptionProgress;
      }) => void = () => {};
      vi.mocked(listen).mockImplementation((event, handler) => {
        if (event === "whisper:progress") {
          progressCallback = handler as unknown as typeof progressCallback;
        }
        return Promise.resolve(() => {});
      });

      vi.mocked(invoke).mockResolvedValue(undefined);

      await createRoot(async (dispose) => {
        const whisper = createWhisper();

        // Simulate a progress event to set the taskId
        progressCallback({
          payload: {
            taskId: "task-456",
            progress: 50,
            elapsedMs: 1000,
          },
        });

        await whisper.cancelTranscription();

        expect(invoke).toHaveBeenCalledWith("cancel_transcription", {
          taskId: "task-456",
        });
        dispose();
      });

      // Reset listen mock to default
      vi.mocked(listen).mockImplementation(() => Promise.resolve(() => {}));
    });
  });

  describe("reset", () => {
    it("should clear file, result, and error", () => {
      createRoot((dispose) => {
        const whisper = createWhisper();

        whisper.setFile(mockFile);
        // Manually trigger an error state for testing
        // We need to use loadModels to set error
        expect(whisper.file()).toEqual(mockFile);

        whisper.reset();

        expect(whisper.file()).toBeNull();
        expect(whisper.result()).toBeNull();
        expect(whisper.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("deleteModel", () => {
    it("should invoke delete_model and reload models", async () => {
      const models = [mockModel({ id: "small", downloaded: true })];
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // delete_model
        .mockResolvedValueOnce(models); // get_available_models

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.deleteModel("large-v3-turbo");

        expect(invoke).toHaveBeenCalledWith("delete_model", {
          modelId: "large-v3-turbo",
        });
        expect(invoke).toHaveBeenCalledWith("get_available_models");
        expect(whisper.models()).toEqual(models);
        dispose();
      });
    });

    it("should clear selectedModel and auto-select if deleted model was selected", async () => {
      const turboModel = mockModel({
        id: "large-v3-turbo",
        downloaded: true,
        recommended: true,
      });
      const smallModel = mockModel({
        id: "small",
        name: "Small",
        downloaded: true,
        recommended: false,
      });

      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // delete_model
        .mockResolvedValueOnce([smallModel]); // get_available_models (turbo removed)

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        whisper.selectModel(turboModel);
        expect(whisper.selectedModel()?.id).toBe("large-v3-turbo");

        await whisper.deleteModel("large-v3-turbo");

        // Should have auto-selected the remaining model
        expect(whisper.selectedModel()?.id).toBe("small");
        dispose();
      });
    });

    it("should not affect selectedModel if a different model was deleted", async () => {
      const turboModel = mockModel({
        id: "large-v3-turbo",
        downloaded: true,
        recommended: true,
      });

      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // delete_model
        .mockResolvedValueOnce([turboModel]); // get_available_models

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        whisper.selectModel(turboModel);

        await whisper.deleteModel("small");

        expect(whisper.selectedModel()?.id).toBe("large-v3-turbo");
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Failed to delete model"),
      );

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.deleteModel("large-v3-turbo");

        expect(whisper.error()).toBe("Failed to delete model");
        dispose();
      });
    });
  });

  describe("clearError", () => {
    it("should set error to null", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Some error"));

      await createRoot(async (dispose) => {
        const whisper = createWhisper();
        await whisper.loadModels();

        expect(whisper.error()).toBe("Some error");

        whisper.clearError();

        expect(whisper.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("event listeners", () => {
    it("should update progress on whisper:progress event", async () => {
      let progressCallback: (event: {
        payload: TranscriptionProgress;
      }) => void = () => {};
      vi.mocked(listen).mockImplementation((event, handler) => {
        if (event === "whisper:progress") {
          progressCallback = handler as unknown as typeof progressCallback;
        }
        return Promise.resolve(() => {});
      });

      await createRoot(async (dispose) => {
        const whisper = createWhisper();

        const progressData: TranscriptionProgress = {
          taskId: "task-789",
          progress: 75,
          elapsedMs: 3000,
          currentSegment: "Processing...",
        };

        progressCallback({ payload: progressData });

        expect(whisper.progress()).toEqual(progressData);
        dispose();
      });

      vi.mocked(listen).mockImplementation(() => Promise.resolve(() => {}));
    });

    it("should update downloadProgress on model:download-progress event", async () => {
      let downloadCallback: (event: { payload: DownloadProgress }) => void =
        () => {};
      vi.mocked(listen).mockImplementation((event, handler) => {
        if (event === "model:download-progress") {
          downloadCallback = handler as unknown as typeof downloadCallback;
        }
        return Promise.resolve(() => {});
      });

      await createRoot(async (dispose) => {
        const whisper = createWhisper();

        const downloadData: DownloadProgress = {
          modelId: "large-v3-turbo",
          downloadedBytes: 500000000,
          totalBytes: 1_739_587_584,
          progress: 28.7,
        };

        downloadCallback({ payload: downloadData });

        expect(whisper.downloadProgress()).toEqual(downloadData);
        dispose();
      });

      vi.mocked(listen).mockImplementation(() => Promise.resolve(() => {}));
    });

    it("should unregister listeners on dispose", async () => {
      const unlistenProgress = vi.fn();
      const unlistenDownload = vi.fn();

      vi.mocked(listen).mockImplementation((event: string) => {
        if (event === "whisper:progress") {
          return Promise.resolve(unlistenProgress);
        }
        if (event === "model:download-progress") {
          return Promise.resolve(unlistenDownload);
        }
        return Promise.resolve(() => {});
      });

      await createRoot(async (dispose) => {
        createWhisper();

        // Allow listen promises to resolve
        await Promise.resolve();

        expect(unlistenProgress).not.toHaveBeenCalled();
        expect(unlistenDownload).not.toHaveBeenCalled();

        dispose();
      });

      // After dispose, unlisten should have been called
      expect(unlistenProgress).toHaveBeenCalled();
      expect(unlistenDownload).toHaveBeenCalled();

      vi.mocked(listen).mockImplementation(() => Promise.resolve(() => {}));
    });
  });
});
