import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  InferenceProgress,
  ServerStatus,
  TextDownloadProgress,
  TextModelInfo,
} from "~/types";

// createTextProcessing keeps its state in a module-level singleton without a
// test reset helper, so every test imports a fresh module instance via
// vi.resetModules() to stay fully self-contained. createSettings is pulled
// from the same fresh registry so its reset helper controls the settings
// state the target module observes.
async function setup() {
  vi.resetModules();
  const { createTextProcessing } = await import("../createTextProcessing");
  const { createSettings, _resetSettingsForTesting } = await import(
    "../createSettings"
  );
  return {
    tp: createTextProcessing(),
    settings: createSettings(),
    resetSettings: _resetSettingsForTesting,
  };
}

const mockModel = (overrides?: Partial<TextModelInfo>): TextModelInfo => ({
  id: "gemma-4-e2b",
  name: "Gemma 4 E2B",
  size: "2.7GB",
  sizeBytes: 2_700_000_000,
  description: "Test model",
  downloaded: true,
  path: "/models/gemma.gguf",
  ...overrides,
});

type InvokeHandler = (args: Record<string, unknown> | undefined) => unknown;

/** Routes mocked invoke calls by command name so tests never depend on call order. */
function mockInvoke(handlers: Record<string, InvokeHandler>): void {
  vi.mocked(invoke).mockImplementation((cmd, args) => {
    const handler = handlers[cmd];
    if (!handler) {
      return Promise.reject(new Error(`Unexpected command: ${cmd}`));
    }
    return Promise.resolve(
      handler(args as Record<string, unknown> | undefined),
    );
  });
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Drains pending microtasks so awaited invoke continuations settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Fires the module-level Tauri event listener registered for `event`. */
function emitEvent<T>(event: string, payload: T): void {
  const calls = vi.mocked(listen).mock.calls.filter(([name]) => name === event);
  const last = calls[calls.length - 1];
  if (!last) {
    throw new Error(`No listener registered for ${event}`);
  }
  const handler = last[1] as unknown as (e: { payload: T }) => void;
  handler({ payload });
}

describe("createTextProcessing", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(listen).mockClear();
  });

  describe("initial state", () => {
    it("starts fully idle", async () => {
      const { tp } = await setup();

      expect(tp.models()).toEqual([]);
      expect(tp.totalSizeBytes()).toBe(0);
      expect(tp.selectedModelId()).toBeNull();
      expect(tp.downloadProgress()).toBeNull();
      expect(tp.serverStatus()).toEqual({ running: false });
      expect(tp.inferenceProgress()).toBeNull();
      expect(tp.chatResult()).toBeNull();
      expect(tp.isDownloading()).toBe(false);
      expect(tp.isProcessing()).toBe(false);
      expect(tp.serverAvailable()).toBe(false);
      expect(tp.downloadPhase()).toBe("idle");
      expect(tp.downloadingModelId()).toBeNull();
      expect(tp.error()).toBeNull();
    });
  });

  describe("loadModels", () => {
    it("populates models from the backend", async () => {
      const models = [mockModel(), mockModel({ id: "qwen", name: "Qwen" })];
      mockInvoke({ text_processing_list_models: () => models });
      const { tp } = await setup();

      await tp.loadModels();

      expect(tp.models()).toEqual(models);
    });

    it("restores the saved model selection when it is downloaded", async () => {
      mockInvoke({
        text_processing_list_models: () => [mockModel({ downloaded: true })],
      });
      const { tp, resetSettings } = await setup();
      resetSettings({ textModelId: "gemma-4-e2b" });

      await tp.loadModels();

      expect(tp.selectedModelId()).toBe("gemma-4-e2b");
    });

    it("ignores the saved selection when the model is not downloaded", async () => {
      mockInvoke({
        text_processing_list_models: () => [mockModel({ downloaded: false })],
      });
      const { tp, resetSettings } = await setup();
      resetSettings({ textModelId: "gemma-4-e2b" });

      await tp.loadModels();

      expect(tp.selectedModelId()).toBeNull();
    });

    it("converts a failure into an AppError", async () => {
      mockInvoke({
        text_processing_list_models: () =>
          Promise.reject(new Error("Failed to list models")),
      });
      const { tp } = await setup();

      await tp.loadModels();

      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "UNKNOWN_ERROR",
          details: "Failed to list models",
        }),
      );
      expect(tp.models()).toEqual([]);
    });
  });

  describe("selectModel", () => {
    it("updates the selection and persists it to settings", async () => {
      const { tp, settings } = await setup();

      tp.selectModel("gemma-4-e2b");

      expect(tp.selectedModelId()).toBe("gemma-4-e2b");
      expect(settings.textModelId()).toBe("gemma-4-e2b");
    });
  });

  describe("effectiveModelId", () => {
    it("prefers the override, then the selection, then undefined", async () => {
      const { tp } = await setup();

      expect(tp.effectiveModelId()).toBeUndefined();

      tp.selectModel("gemma-4-e2b");
      expect(tp.effectiveModelId()).toBe("gemma-4-e2b");
      expect(tp.effectiveModelId("qwen")).toBe("qwen");
    });
  });

  describe("downloadModel", () => {
    it("runs the two-phase download when the server is missing", async () => {
      const server = deferred();
      const model = deferred();
      const downloadedModel = mockModel({ downloaded: true });
      mockInvoke({
        text_processing_download_server: () => server.promise,
        text_processing_download_model: () => model.promise,
        text_processing_list_models: () => [downloadedModel],
      });
      const { tp } = await setup();

      const result = tp.downloadModel("gemma-4-e2b");

      expect(tp.isDownloading()).toBe(true);
      expect(tp.downloadPhase()).toBe("server");
      expect(tp.downloadingModelId()).toBe("gemma-4-e2b");

      // Progress emitted during the server phase is cleared on phase switch
      emitEvent<TextDownloadProgress>("text-processing:download-progress", {
        modelId: "llama-server",
        downloadedBytes: 10,
        totalBytes: 100,
        progress: 10,
      });
      server.resolve();
      await flush();

      expect(tp.serverAvailable()).toBe(true);
      expect(tp.downloadPhase()).toBe("model");
      expect(tp.downloadProgress()).toBeNull();

      model.resolve();
      await expect(result).resolves.toBe(true);

      expect(tp.models()).toEqual([downloadedModel]);
      expect(tp.isDownloading()).toBe(false);
      expect(tp.downloadPhase()).toBe("idle");
      expect(tp.downloadingModelId()).toBeNull();
    });

    it("starts directly at the model phase when the server is available", async () => {
      const model = deferred();
      mockInvoke({
        text_processing_check_server: () => true,
        text_processing_download_model: () => model.promise,
        text_processing_list_models: () => [],
      });
      const { tp } = await setup();
      await tp.checkServer();

      const result = tp.downloadModel("gemma-4-e2b");

      expect(tp.downloadPhase()).toBe("model");

      model.resolve();
      await expect(result).resolves.toBe(true);
    });

    it("returns false when another download is already in progress", async () => {
      const server = deferred();
      mockInvoke({
        text_processing_download_server: () => server.promise,
        text_processing_download_model: () => undefined,
        text_processing_list_models: () => [],
      });
      const { tp } = await setup();

      const first = tp.downloadModel("gemma-4-e2b");
      const second = await tp.downloadModel("qwen");

      expect(second).toBe(false);
      // The first download still owns the mutex and completes normally
      expect(tp.downloadingModelId()).toBe("gemma-4-e2b");

      server.resolve();
      await expect(first).resolves.toBe(true);
    });

    it("converts a download failure into an AppError and resets to idle", async () => {
      mockInvoke({
        text_processing_check_server: () => true,
        text_processing_download_model: () =>
          Promise.reject("Download failed: connection reset"),
      });
      const { tp } = await setup();
      await tp.checkServer();

      const result = await tp.downloadModel("gemma-4-e2b");

      expect(result).toBe(false);
      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "MODEL_DOWNLOAD_ERROR",
          category: "model",
          recoverable: true,
          details: "Download failed: connection reset",
        }),
      );
      expect(tp.isDownloading()).toBe(false);
      expect(tp.downloadPhase()).toBe("idle");
      expect(tp.downloadingModelId()).toBeNull();
    });
  });

  describe("downloadServer", () => {
    it("marks the server available and returns true", async () => {
      const server = deferred();
      mockInvoke({ text_processing_download_server: () => server.promise });
      const { tp } = await setup();

      const result = tp.downloadServer();

      expect(tp.isDownloading()).toBe(true);
      expect(tp.downloadPhase()).toBe("server");
      expect(tp.downloadingModelId()).toBeNull();

      server.resolve();
      await expect(result).resolves.toBe(true);

      expect(tp.serverAvailable()).toBe(true);
      expect(tp.isDownloading()).toBe(false);
      expect(tp.downloadPhase()).toBe("idle");
    });

    it("sets an AppError and returns false on failure", async () => {
      mockInvoke({
        text_processing_download_server: () =>
          Promise.reject("Download failed: 404"),
      });
      const { tp } = await setup();

      const result = await tp.downloadServer();

      expect(result).toBe(false);
      expect(tp.serverAvailable()).toBe(false);
      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "MODEL_DOWNLOAD_ERROR",
          details: "Download failed: 404",
        }),
      );
      expect(tp.downloadPhase()).toBe("idle");
    });
  });

  describe("deleteModel", () => {
    it("selects the next downloaded model when the selected one is deleted", async () => {
      const remaining = mockModel({ id: "qwen", name: "Qwen" });
      mockInvoke({
        text_processing_delete_model: () => undefined,
        text_processing_list_models: () => [remaining],
      });
      const { tp, settings } = await setup();
      tp.selectModel("gemma-4-e2b");

      await tp.deleteModel("gemma-4-e2b");

      expect(tp.selectedModelId()).toBe("qwen");
      expect(settings.textModelId()).toBe("qwen");
    });

    it("clears the selection and settings when no downloaded model remains", async () => {
      mockInvoke({
        text_processing_delete_model: () => undefined,
        text_processing_list_models: () => [
          mockModel({ id: "qwen", downloaded: false }),
        ],
      });
      const { tp, settings } = await setup();
      tp.selectModel("gemma-4-e2b");

      await tp.deleteModel("gemma-4-e2b");

      expect(tp.selectedModelId()).toBeNull();
      expect(settings.textModelId()).toBeNull();
    });

    it("keeps the selection when a different model is deleted", async () => {
      mockInvoke({
        text_processing_delete_model: () => undefined,
        text_processing_list_models: () => [mockModel({ downloaded: true })],
      });
      const { tp } = await setup();
      tp.selectModel("gemma-4-e2b");

      await tp.deleteModel("qwen");

      expect(tp.selectedModelId()).toBe("gemma-4-e2b");
    });

    it("converts a failure into an AppError", async () => {
      mockInvoke({
        text_processing_delete_model: () =>
          Promise.reject("Model not found: qwen"),
      });
      const { tp } = await setup();

      await tp.deleteModel("qwen");

      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "MODEL_NOT_FOUND",
          details: "Model not found: qwen",
        }),
      );
    });
  });

  describe("deleteServer", () => {
    it("marks the server unavailable and returns true", async () => {
      mockInvoke({
        text_processing_check_server: () => true,
        text_processing_delete_server: () => undefined,
      });
      const { tp } = await setup();
      await tp.checkServer();
      expect(tp.serverAvailable()).toBe(true);

      const result = await tp.deleteServer();

      expect(result).toBe(true);
      expect(tp.serverAvailable()).toBe(false);
    });

    it("sets an AppError, keeps availability, and returns false on failure", async () => {
      mockInvoke({
        text_processing_check_server: () => true,
        text_processing_delete_server: () =>
          Promise.reject("IO error: permission denied"),
      });
      const { tp } = await setup();
      await tp.checkServer();

      const result = await tp.deleteServer();

      expect(result).toBe(false);
      expect(tp.serverAvailable()).toBe(true);
      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "FILE_READ_ERROR",
          details: "IO error: permission denied",
        }),
      );
    });
  });

  describe("checkServer", () => {
    it("reflects the backend server availability", async () => {
      mockInvoke({ text_processing_check_server: () => true });
      const { tp } = await setup();

      await tp.checkServer();

      expect(tp.serverAvailable()).toBe(true);
    });
  });

  describe("checkServerStatus", () => {
    it("reflects the backend server status", async () => {
      const status: ServerStatus = {
        running: true,
        port: 8080,
        modelId: "gemma-4-e2b",
      };
      mockInvoke({ text_processing_server_status: () => status });
      const { tp } = await setup();

      await tp.checkServerStatus();

      expect(tp.serverStatus()).toEqual(status);
    });
  });

  describe("chat", () => {
    it("returns the result, stores it, and sends the selected model id", async () => {
      mockInvoke({ text_processing_chat: () => "processed text" });
      const { tp } = await setup();
      tp.selectModel("gemma-4-e2b");

      const result = await tp.chat("hello");

      expect(result).toBe("processed text");
      expect(tp.chatResult()).toBe("processed text");
      expect(invoke).toHaveBeenCalledWith("text_processing_chat", {
        text: "hello",
        modelId: "gemma-4-e2b",
      });
    });

    it("prefers an explicit model override and falls back to backend auto-pick", async () => {
      mockInvoke({ text_processing_chat: () => "ok" });
      const { tp } = await setup();

      // No selection: modelId undefined lets the backend auto-pick
      await tp.chat("hello");
      expect(invoke).toHaveBeenCalledWith("text_processing_chat", {
        text: "hello",
        modelId: undefined,
      });

      // Explicit override wins over the current selection
      tp.selectModel("gemma-4-e2b");
      await tp.chat("hello", "qwen");
      expect(invoke).toHaveBeenCalledWith("text_processing_chat", {
        text: "hello",
        modelId: "qwen",
      });
    });

    it("clears stale results and toggles isProcessing during a new run", async () => {
      mockInvoke({ text_processing_chat: () => "first" });
      const { tp } = await setup();
      await tp.chat("one");
      emitEvent<InferenceProgress>("text-processing:inference-progress", {
        taskId: "task-1",
        token: "t",
        accumulatedText: "t",
        done: true,
      });
      expect(tp.chatResult()).toBe("first");
      expect(tp.inferenceProgress()).not.toBeNull();

      const second = deferred<string>();
      mockInvoke({ text_processing_chat: () => second.promise });
      const pending = tp.chat("two");

      expect(tp.isProcessing()).toBe(true);
      expect(tp.chatResult()).toBeNull();
      expect(tp.inferenceProgress()).toBeNull();

      second.resolve("second");
      await expect(pending).resolves.toBe("second");
      expect(tp.isProcessing()).toBe(false);
      expect(tp.chatResult()).toBe("second");
    });

    it("returns null when a chat is already processing", async () => {
      const first = deferred<string>();
      mockInvoke({ text_processing_chat: () => first.promise });
      const { tp } = await setup();

      const pending = tp.chat("one");
      const second = await tp.chat("two");

      expect(second).toBeNull();

      first.resolve("done");
      await expect(pending).resolves.toBe("done");
    });

    it("converts an inference failure into an AppError and returns null", async () => {
      mockInvoke({
        text_processing_chat: () => Promise.reject("Inference error: boom"),
      });
      const { tp } = await setup();

      const result = await tp.chat("hello");

      expect(result).toBeNull();
      expect(tp.chatResult()).toBeNull();
      expect(tp.isProcessing()).toBe(false);
      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "INFERENCE_ERROR",
          details: "Inference error: boom",
        }),
      );
    });

    it("maps a cancelled inference to a non-recoverable CANCELLED error", async () => {
      mockInvoke({
        text_processing_chat: () => Promise.reject("Inference cancelled"),
      });
      const { tp } = await setup();

      const result = await tp.chat("hello");

      expect(result).toBeNull();
      expect(tp.error()).toEqual(
        expect.objectContaining({
          code: "CANCELLED",
          category: "cancelled",
          recoverable: false,
        }),
      );
    });
  });

  describe("generateTitle", () => {
    it("returns the generated title with the effective model id", async () => {
      mockInvoke({ text_processing_generate_title: () => "Meeting notes" });
      const { tp } = await setup();
      tp.selectModel("gemma-4-e2b");

      const title = await tp.generateTitle("long transcription text");

      expect(title).toBe("Meeting notes");
      expect(invoke).toHaveBeenCalledWith("text_processing_generate_title", {
        text: "long transcription text",
        modelId: "gemma-4-e2b",
      });
    });

    it("propagates failures so the caller can surface them", async () => {
      mockInvoke({
        text_processing_generate_title: () =>
          Promise.reject("Inference error: boom"),
      });
      const { tp } = await setup();

      await expect(tp.generateTitle("text")).rejects.toBe(
        "Inference error: boom",
      );
      // The primitive itself stays error-free; createAiSession owns the error.
      expect(tp.error()).toBeNull();
    });
  });

  describe("cancel", () => {
    it("cancels the task reported by the latest inference progress", async () => {
      mockInvoke({ text_processing_cancel: () => undefined });
      const { tp } = await setup();
      emitEvent<InferenceProgress>("text-processing:inference-progress", {
        taskId: "task-42",
        token: "t",
        accumulatedText: "t",
        done: false,
      });

      await tp.cancel();

      expect(invoke).toHaveBeenCalledWith("text_processing_cancel", {
        taskId: "task-42",
      });
    });

    it("resolves as a no-op when no inference is in flight", async () => {
      const { tp } = await setup();

      await expect(tp.cancel()).resolves.toBeUndefined();
    });
  });

  describe("clearError", () => {
    it("resets the error to null", async () => {
      mockInvoke({
        text_processing_list_models: () => Promise.reject(new Error("boom")),
      });
      const { tp } = await setup();
      await tp.loadModels();
      expect(tp.error()).not.toBeNull();

      tp.clearError();

      expect(tp.error()).toBeNull();
    });
  });

  describe("totalSizeBytes", () => {
    it("sums the size of downloaded models only", async () => {
      mockInvoke({
        text_processing_list_models: () => [
          mockModel({ id: "a", sizeBytes: 500, downloaded: true }),
          mockModel({ id: "b", sizeBytes: 1_500, downloaded: true }),
          mockModel({ id: "c", sizeBytes: 999, downloaded: false }),
        ],
      });
      const { tp } = await setup();

      await tp.loadModels();

      expect(tp.totalSizeBytes()).toBe(500 + 1_500);
    });
  });

  describe("event listeners", () => {
    it("updates downloadProgress on text-processing:download-progress", async () => {
      const { tp } = await setup();
      const progress: TextDownloadProgress = {
        modelId: "gemma-4-e2b",
        downloadedBytes: 1_350_000_000,
        totalBytes: 2_700_000_000,
        progress: 50,
      };

      emitEvent("text-processing:download-progress", progress);

      expect(tp.downloadProgress()).toEqual(progress);
    });

    it("updates inferenceProgress on text-processing:inference-progress", async () => {
      const { tp } = await setup();
      const progress: InferenceProgress = {
        taskId: "task-7",
        token: "world",
        accumulatedText: "hello world",
        done: false,
      };

      emitEvent("text-processing:inference-progress", progress);

      expect(tp.inferenceProgress()).toEqual(progress);
    });

    it("registers both listeners at module level (singleton)", async () => {
      await setup();

      const listenCalls = vi.mocked(listen).mock.calls.map(([event]) => event);
      expect(listenCalls).toContain("text-processing:download-progress");
      expect(listenCalls).toContain("text-processing:inference-progress");
    });
  });
});
