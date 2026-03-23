import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import type {
  InferenceProgress,
  ServerStatus,
  SummaryOptions,
  TextDownloadProgress,
  TextModelInfo,
} from "~/types";
import type { AppError } from "~/types/errors";

// Module-level singleton state — all consumers share the same signals.
const {
  models,
  setModels,
  downloadProgress,
  setDownloadProgress,
  serverStatus,
  setServerStatus,
  inferenceProgress,
  setInferenceProgress,
  proofreadResult,
  setProofreadResult,
  chatResult,
  setChatResult,
  summaryResult,
  setSummaryResult,
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
  const [downloadProgress, setDownloadProgress] =
    createSignal<TextDownloadProgress | null>(null);
  const [serverStatus, setServerStatus] = createSignal<ServerStatus>({
    running: false,
  });
  const [inferenceProgress, setInferenceProgress] =
    createSignal<InferenceProgress | null>(null);
  const [proofreadResult, setProofreadResult] = createSignal<string | null>(
    null,
  );
  const [chatResult, setChatResult] = createSignal<string | null>(null);
  const [summaryResult, setSummaryResult] = createSignal<string | null>(null);
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
    downloadProgress,
    setDownloadProgress,
    serverStatus,
    setServerStatus,
    inferenceProgress,
    setInferenceProgress,
    proofreadResult,
    setProofreadResult,
    chatResult,
    setChatResult,
    summaryResult,
    setSummaryResult,
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
  } catch (e) {
    setError(parseError(e));
  }
}

async function downloadModel(modelId: string): Promise<boolean> {
  if (isDownloading()) return false;
  setIsDownloading(true);
  setDownloadingModelId(modelId);
  try {
    // Phase 1: サーバーが未ダウンロードなら自動取得
    if (!serverAvailable()) {
      setDownloadPhase("server");
      await invoke("text_processing_download_server");
      setServerAvailable(true);
    }
    // Phase 2: モデルダウンロード
    setDownloadPhase("model");
    await invoke("text_processing_download_model", { modelId });
    await loadModels();
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  } finally {
    setDownloadPhase("idle");
    setDownloadingModelId(null);
    setIsDownloading(false);
  }
}

async function deleteModel(modelId: string): Promise<void> {
  try {
    await invoke("text_processing_delete_model", { modelId });
    await loadModels();
  } catch (e) {
    setError(parseError(e));
  }
}

async function downloadServer(): Promise<boolean> {
  if (isDownloading()) return false;
  setIsDownloading(true);
  setDownloadPhase("server");
  try {
    await invoke("text_processing_download_server");
    setServerAvailable(true);
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  } finally {
    setDownloadPhase("idle");
    setIsDownloading(false);
  }
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
      modelId,
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

async function proofread(
  text: string,
  modelId?: string,
): Promise<string | null> {
  if (isProcessing()) return null;
  setIsProcessing(true);
  setProofreadResult(null);
  setInferenceProgress(null);
  try {
    const result = await invoke<string>("text_processing_proofread", {
      text,
      modelId,
    });
    setProofreadResult(result);
    return result;
  } catch (e) {
    setError(parseError(e));
    return null;
  } finally {
    setIsProcessing(false);
  }
}

async function summarize(
  text: string,
  options?: SummaryOptions,
  modelId?: string,
): Promise<string | null> {
  if (isProcessing()) return null;
  setIsProcessing(true);
  setSummaryResult(null);
  setInferenceProgress(null);
  try {
    const result = await invoke<string>("text_processing_summarize", {
      text,
      options,
      modelId,
    });
    setSummaryResult(result);
    return result;
  } catch (e) {
    setError(parseError(e));
    return null;
  } finally {
    setIsProcessing(false);
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

const textProcessingInstance = {
  // State (Accessors)
  models,
  downloadProgress,
  serverStatus,
  inferenceProgress,
  chatResult,
  proofreadResult,
  summaryResult,
  isDownloading,
  isProcessing,
  serverAvailable,
  downloadPhase,
  downloadingModelId,
  error,

  // Actions
  chat,
  loadModels,
  downloadModel,
  deleteModel,
  downloadServer,
  deleteServer,
  checkServer,
  checkServerStatus,
  proofread,
  summarize,
  cancel,
  clearError,
};

export function createTextProcessing() {
  return textProcessingInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetTextProcessingForTesting(): void {
  setModels([]);
  setDownloadProgress(null);
  setServerStatus({ running: false });
  setInferenceProgress(null);
  setProofreadResult(null);
  setChatResult(null);
  setSummaryResult(null);
  setIsDownloading(false);
  setIsProcessing(false);
  setServerAvailable(false);
  setDownloadPhase("idle");
  setDownloadingModelId(null);
  setError(null);
}
