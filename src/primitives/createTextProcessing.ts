import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createSignal, onCleanup } from "solid-js";
import { parseError } from "../lib/errors";
import type {
  InferenceProgress,
  ServerStatus,
  SummaryOptions,
  TextDownloadProgress,
  TextModelInfo,
} from "../types";
import type { AppError } from "../types/errors";

export function createTextProcessing() {
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
  const [error, setError] = createSignal<AppError | null>(null);

  // Event listeners with cleanup
  let unlistenDownload: (() => void) | undefined;
  let unlistenInference: (() => void) | undefined;

  listen<TextDownloadProgress>("text-processing:download-progress", (event) => {
    setDownloadProgress(event.payload);
  }).then((fn) => {
    unlistenDownload = fn;
  });

  listen<InferenceProgress>("text-processing:inference-progress", (event) => {
    setInferenceProgress(event.payload);
  }).then((fn) => {
    unlistenInference = fn;
  });

  onCleanup(() => {
    unlistenDownload?.();
    unlistenInference?.();
  });

  async function loadModels(): Promise<void> {
    try {
      const result = await invoke<TextModelInfo[]>(
        "text_processing_list_models",
      );
      setModels(result);
    } catch (e) {
      setError(parseError(e));
    }
  }

  async function downloadModel(modelId: string): Promise<void> {
    if (isDownloading()) return;
    setIsDownloading(true);
    try {
      await invoke("text_processing_download_model", { modelId });
      await loadModels();
    } catch (e) {
      setError(parseError(e));
    } finally {
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

  async function downloadServer(): Promise<void> {
    if (isDownloading()) return;
    setIsDownloading(true);
    try {
      await invoke("text_processing_download_server");
      setServerAvailable(true);
    } catch (e) {
      setError(parseError(e));
    } finally {
      setIsDownloading(false);
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
      const status = await invoke<ServerStatus>(
        "text_processing_server_status",
      );
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

  return {
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
    error,

    // Actions
    chat,
    loadModels,
    downloadModel,
    deleteModel,
    downloadServer,
    checkServer,
    checkServerStatus,
    proofread,
    summarize,
    cancel,
    clearError,
  };
}
