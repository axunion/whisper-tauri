import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { batch, createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import { sumDownloadedBytes } from "~/lib/format";
import { createSettings } from "~/primitives/createSettings";
import type {
  InferenceProgress,
  ServerStatus,
  TextDownloadProgress,
  TextModelInfo,
} from "~/types";
import type { AppError } from "~/types/errors";

// Module-level singleton state — server, model, download, and chat concerns only.
const {
  models,
  setModels,
  selectedModelId,
  setSelectedModelId,
  downloadProgress,
  setDownloadProgress,
  serverStatus,
  setServerStatus,
  inferenceProgress,
  setInferenceProgress,
  chatResult,
  setChatResult,
  isDownloading,
  setIsDownloading,
  isProcessing,
  setIsProcessing,
  serverAvailable,
  setServerAvailable,
  downloadPhase,
  setDownloadPhase,
  downloadingModelId,
  setDownloadingModelId,
  error,
  setError,
} = createRoot(() => {
  const [models, setModels] = createSignal<TextModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = createSignal<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] =
    createSignal<TextDownloadProgress | null>(null);
  const [serverStatus, setServerStatus] = createSignal<ServerStatus>({
    running: false,
  });
  const [inferenceProgress, setInferenceProgress] =
    createSignal<InferenceProgress | null>(null);
  const [chatResult, setChatResult] = createSignal<string | null>(null);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [serverAvailable, setServerAvailable] = createSignal(false);
  const [downloadPhase, setDownloadPhase] = createSignal<
    "idle" | "server" | "model"
  >("idle");
  const [downloadingModelId, setDownloadingModelId] = createSignal<
    string | null
  >(null);
  const [error, setError] = createSignal<AppError | null>(null);

  return {
    models,
    setModels,
    selectedModelId,
    setSelectedModelId,
    downloadProgress,
    setDownloadProgress,
    serverStatus,
    setServerStatus,
    inferenceProgress,
    setInferenceProgress,
    chatResult,
    setChatResult,
    isDownloading,
    setIsDownloading,
    isProcessing,
    setIsProcessing,
    serverAvailable,
    setServerAvailable,
    downloadPhase,
    setDownloadPhase,
    downloadingModelId,
    setDownloadingModelId,
    error,
    setError,
  };
});

// Event listeners at module level — persist for the app lifetime.
listen<TextDownloadProgress>("text-processing:download-progress", (event) => {
  setDownloadProgress(event.payload);
}).catch(console.error);

listen<InferenceProgress>("text-processing:inference-progress", (event) => {
  setInferenceProgress(event.payload);
}).catch(console.error);

async function loadModels(): Promise<void> {
  try {
    const result = await invoke<TextModelInfo[]>("text_processing_list_models");
    setModels(result);
    // Restore selection from settings if not yet set
    if (!selectedModelId()) {
      const savedId = createSettings().textModelId();
      if (savedId) {
        const exists = result.some((m) => m.id === savedId && m.downloaded);
        if (exists) {
          setSelectedModelId(savedId);
        }
      }
    }
  } catch (e) {
    setError(parseError(e));
  }
}

function selectModel(modelId: string): void {
  setSelectedModelId(modelId);
  createSettings().update({ textModelId: modelId });
}

/** Returns the effective model ID: explicit selection or undefined for backend auto-pick. */
function effectiveModelId(override?: string): string | undefined {
  return override ?? selectedModelId() ?? undefined;
}

// Shared mutex + phase reset + error handling for the two download paths.
// `modelId` is set as `downloadingModelId` so the model list can highlight
// the in-progress row; pass null when only the server is being fetched.
// `initialPhase` is set inside the same batch as the mutex flags so memos
// reading both never see a transient (isDownloading: true, phase: "idle").
async function runDownload(
  modelId: string | null,
  initialPhase: "server" | "model",
  body: () => Promise<void>,
): Promise<boolean> {
  if (isDownloading()) return false;
  batch(() => {
    setIsDownloading(true);
    setDownloadingModelId(modelId);
    setDownloadPhase(initialPhase);
    setDownloadProgress(null);
  });
  try {
    await body();
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  } finally {
    batch(() => {
      setDownloadPhase("idle");
      setDownloadingModelId(null);
      setIsDownloading(false);
    });
  }
}

async function downloadModel(modelId: string): Promise<boolean> {
  const startPhase: "server" | "model" = serverAvailable() ? "model" : "server";
  return runDownload(modelId, startPhase, async () => {
    // Phase 1: download the llama-server binary if not yet available
    if (!serverAvailable()) {
      await invoke("text_processing_download_server");
      setServerAvailable(true);
      batch(() => {
        setDownloadPhase("model");
        setDownloadProgress(null);
      });
    }
    // Phase 2: download the model
    await invoke("text_processing_download_model", { modelId });
    await loadModels();
  });
}

async function deleteModel(modelId: string): Promise<void> {
  try {
    await invoke("text_processing_delete_model", { modelId });
    const wasSelected = selectedModelId() === modelId;
    if (wasSelected) {
      setSelectedModelId(null);
    }
    await loadModels();
    if (wasSelected) {
      const next = models().find((m) => m.downloaded);
      if (next) {
        selectModel(next.id);
      } else {
        createSettings().update({ textModelId: null });
      }
    }
  } catch (e) {
    setError(parseError(e));
  }
}

async function downloadServer(): Promise<boolean> {
  return runDownload(null, "server", async () => {
    await invoke("text_processing_download_server");
    setServerAvailable(true);
  });
}

async function deleteServer(): Promise<boolean> {
  try {
    await invoke("text_processing_delete_server");
    setServerAvailable(false);
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  }
}

async function checkServer(): Promise<void> {
  try {
    const exists = await invoke<boolean>("text_processing_check_server");
    setServerAvailable(exists);
  } catch (e) {
    setError(parseError(e));
  }
}

async function checkServerStatus(): Promise<void> {
  try {
    const status = await invoke<ServerStatus>("text_processing_server_status");
    setServerStatus(status);
  } catch (e) {
    setError(parseError(e));
  }
}

async function chat(text: string, modelId?: string): Promise<string | null> {
  if (isProcessing()) return null;
  setIsProcessing(true);
  setChatResult(null);
  setInferenceProgress(null);
  try {
    const result = await invoke<string>("text_processing_chat", {
      text,
      modelId: effectiveModelId(modelId),
    });
    setChatResult(result);
    return result;
  } catch (e) {
    setError(parseError(e));
    return null;
  } finally {
    setIsProcessing(false);
  }
}

async function generateTitle(
  text: string,
  modelId?: string,
): Promise<string | null> {
  // Title generation doesn't use isProcessing to avoid blocking other operations
  try {
    const result = await invoke<string>("text_processing_generate_title", {
      text,
      modelId: effectiveModelId(modelId),
    });
    return result;
  } catch (e) {
    // Best-effort: silently fail
    console.error("Title generation failed:", e);
    return null;
  }
}

async function cancel(): Promise<void> {
  const progress = inferenceProgress();
  if (progress) {
    await invoke("text_processing_cancel", { taskId: progress.taskId });
  }
}

function clearError(): void {
  setError(null);
}

function totalSizeBytes(): number {
  return sumDownloadedBytes(models());
}

const textProcessingInstance = {
  // State (Accessors)
  models,
  totalSizeBytes,
  selectedModelId,
  downloadProgress,
  serverStatus,
  inferenceProgress,
  chatResult,
  isDownloading,
  isProcessing,
  serverAvailable,
  downloadPhase,
  downloadingModelId,
  error,

  // Actions
  effectiveModelId,
  selectModel,
  chat,
  loadModels,
  downloadModel,
  deleteModel,
  downloadServer,
  deleteServer,
  checkServer,
  checkServerStatus,
  generateTitle,
  cancel,
  clearError,
};

export function createTextProcessing() {
  return textProcessingInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetTextProcessingForTesting(): void {
  setModels([]);
  setSelectedModelId(null);
  setDownloadProgress(null);
  setServerStatus({ running: false });
  setInferenceProgress(null);
  setChatResult(null);
  setIsDownloading(false);
  setIsProcessing(false);
  setServerAvailable(false);
  setDownloadPhase("idle");
  setDownloadingModelId(null);
  setError(null);
}
