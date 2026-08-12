import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { batch, createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import { sumDownloadedBytes } from "~/lib/format";
import { createSettings } from "~/primitives/createSettings";
import type {
  InferenceProgress,
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

// Load-once guards for the model list and the server probe. Each flag flips
// only on success and the in-flight promise is released either way, so a
// transient IPC failure still retries on the next call.
let modelsLoaded = false;
let loadModelsPromise: Promise<void> | null = null;
let serverChecked = false;
let checkServerPromise: Promise<void> | null = null;

/** Unguarded refresh — used after mutations that change what is on disk. */
async function fetchModels(): Promise<void> {
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
    modelsLoaded = true;
  } catch (e) {
    setError(parseError(e));
  }
}

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadModelsPromise) return loadModelsPromise;
  loadModelsPromise = fetchModels().finally(() => {
    loadModelsPromise = null;
  });
  return loadModelsPromise;
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
    await fetchModels();
  });
}

async function deleteModel(modelId: string): Promise<boolean> {
  try {
    await invoke("text_processing_delete_model", { modelId });
    const wasSelected = selectedModelId() === modelId;
    if (wasSelected) {
      setSelectedModelId(null);
    }
    await fetchModels();
    if (wasSelected) {
      const next = models().find((m) => m.downloaded);
      if (next) {
        selectModel(next.id);
      } else {
        createSettings().update({ textModelId: null });
      }
    }
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
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

async function fetchServerAvailability(): Promise<void> {
  try {
    const exists = await invoke<boolean>("text_processing_check_server");
    setServerAvailable(exists);
    serverChecked = true;
  } catch (e) {
    setError(parseError(e));
  }
}

async function checkServer(): Promise<void> {
  if (serverChecked) return;
  if (checkServerPromise) return checkServerPromise;
  checkServerPromise = fetchServerAvailability().finally(() => {
    checkServerPromise = null;
  });
  return checkServerPromise;
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
  // Title generation doesn't use isProcessing to avoid blocking other
  // operations. Errors propagate so the caller (createAiSession) can set
  // its session error and surface a toast.
  return invoke<string>("text_processing_generate_title", {
    text,
    modelId: effectiveModelId(modelId),
  });
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

function hasDownloadedModel(): boolean {
  return models().some((m) => m.downloaded);
}

/** The single definition of "the LLM stack is usable". */
function isReady(): boolean {
  return serverAvailable() && hasDownloadedModel();
}

const textProcessingInstance = {
  // State (Accessors)
  models,
  totalSizeBytes,
  selectedModelId,
  downloadProgress,
  inferenceProgress,
  chatResult,
  isDownloading,
  isProcessing,
  serverAvailable,
  hasDownloadedModel,
  isReady,
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
  generateTitle,
  cancel,
  clearError,
};

export function createTextProcessing() {
  return textProcessingInstance;
}
