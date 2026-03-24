import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import { createSettings } from "~/primitives/createSettings";
import type {
  AiContentType,
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
  summaryResult,
  setSummaryResult,
  keywordsResult,
  setKeywordsResult,
  actionItemsResult,
  setActionItemsResult,
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
  currentOperation,
  setCurrentOperation,
  analyzeAllCancelled,
  setAnalyzeAllCancelled,
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
  const [summaryResult, setSummaryResult] = createSignal<string | null>(null);
  const [keywordsResult, setKeywordsResult] = createSignal<string | null>(null);
  const [actionItemsResult, setActionItemsResult] = createSignal<string | null>(
    null,
  );
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
  const [currentOperation, setCurrentOperation] = createSignal<
    "summary" | "keywords" | "actionItems" | null
  >(null);
  const [analyzeAllCancelled, setAnalyzeAllCancelled] = createSignal(false);

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
    summaryResult,
    setSummaryResult,
    keywordsResult,
    setKeywordsResult,
    actionItemsResult,
    setActionItemsResult,
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
    currentOperation,
    setCurrentOperation,
    analyzeAllCancelled,
    setAnalyzeAllCancelled,
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
    if (selectedModelId() === modelId) {
      setSelectedModelId(null);
      createSettings().update({ textModelId: null });
    }
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

async function summarize(
  text: string,
  options?: SummaryOptions,
  modelId?: string,
  historyId?: string,
): Promise<string | null> {
  if (isProcessing()) return null;
  setIsProcessing(true);
  setCurrentOperation("summary");
  setSummaryResult(null);
  setActionItemsResult(null);
  setInferenceProgress(null);
  try {
    const usedModelId = effectiveModelId(modelId);
    const result = await invoke<string>("text_processing_summarize", {
      text,
      options,
      modelId: usedModelId,
    });
    setSummaryResult(result);
    if (historyId && result) {
      invoke("history_save_ai_content", {
        params: {
          historyId,
          contentType: "summary",
          text: result,
          optionsJson: options ? JSON.stringify(options) : undefined,
          textModelId: usedModelId ?? "unknown",
        },
      }).catch(console.error);
    }

    // Auto-extract action items after summary
    if (result && !analyzeAllCancelled()) {
      setCurrentOperation("actionItems");
      setInferenceProgress(null);
      try {
        const actionResult = await invoke<string>(
          "text_processing_extract_action_items",
          { text, modelId: usedModelId },
        );
        setActionItemsResult(actionResult);
        if (historyId && actionResult) {
          invoke("history_save_ai_content", {
            params: {
              historyId,
              contentType: "actionItems",
              text: actionResult,
              textModelId: usedModelId ?? "unknown",
            },
          }).catch(console.error);
        }
      } catch {
        // Action items extraction is best-effort
      }
    }

    return result;
  } catch (e) {
    setError(parseError(e));
    return null;
  } finally {
    setCurrentOperation(null);
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

async function runExtraction(
  command: string,
  contentType: AiContentType,
  setResult: (v: string | null) => void,
  text: string,
  modelId?: string,
  historyId?: string,
): Promise<string | null> {
  if (isProcessing()) return null;
  setIsProcessing(true);
  setResult(null);
  setInferenceProgress(null);
  try {
    const usedModelId = effectiveModelId(modelId);
    const result = await invoke<string>(command, {
      text,
      modelId: usedModelId,
    });
    setResult(result);
    if (historyId && result) {
      invoke("history_save_ai_content", {
        params: {
          historyId,
          contentType,
          text: result,
          textModelId: usedModelId ?? "unknown",
        },
      }).catch(console.error);
    }
    return result;
  } catch (e) {
    setError(parseError(e));
    return null;
  } finally {
    setIsProcessing(false);
  }
}

async function extractKeywords(
  text: string,
  modelId?: string,
  historyId?: string,
): Promise<string | null> {
  return runExtraction(
    "text_processing_extract_keywords",
    "keywords",
    setKeywordsResult,
    text,
    modelId,
    historyId,
  );
}

async function extractActionItems(
  text: string,
  modelId?: string,
  historyId?: string,
): Promise<string | null> {
  return runExtraction(
    "text_processing_extract_action_items",
    "actionItems",
    setActionItemsResult,
    text,
    modelId,
    historyId,
  );
}

async function summarizeAndKeywords(
  text: string,
  options?: SummaryOptions,
  modelId?: string,
  historyId?: string,
): Promise<boolean> {
  setAnalyzeAllCancelled(false);

  // Step 1: Summarize (includes auto action items)
  const summaryOk = await summarize(text, options, modelId, historyId);
  if (!summaryOk || analyzeAllCancelled()) {
    return false;
  }

  // Step 2: Keywords
  const keywordsOk = await extractKeywords(text, modelId, historyId);
  return !!keywordsOk;
}

async function cancel(): Promise<void> {
  setAnalyzeAllCancelled(true);
  const progress = inferenceProgress();
  if (progress) {
    await invoke("text_processing_cancel", { taskId: progress.taskId });
  }
}

function clearSummary(): void {
  if (isProcessing()) {
    cancel();
  }
  setSummaryResult(null);
  setInferenceProgress(null);
}

function clearError(): void {
  setError(null);
}

const textProcessingInstance = {
  // State (Accessors)
  models,
  selectedModelId,
  downloadProgress,
  serverStatus,
  inferenceProgress,
  chatResult,
  summaryResult,
  keywordsResult,
  actionItemsResult,
  isDownloading,
  isProcessing,
  serverAvailable,
  downloadPhase,
  downloadingModelId,
  error,
  currentOperation,

  // Actions
  selectModel,
  chat,
  loadModels,
  downloadModel,
  deleteModel,
  downloadServer,
  deleteServer,
  checkServer,
  checkServerStatus,
  summarize,
  generateTitle,
  extractKeywords,
  extractActionItems,
  summarizeAndKeywords,
  cancel,
  clearSummary,
  setSummaryResult,
  setKeywordsResult,
  setActionItemsResult,
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
  setSummaryResult(null);
  setKeywordsResult(null);
  setActionItemsResult(null);
  setIsDownloading(false);
  setIsProcessing(false);
  setServerAvailable(false);
  setDownloadPhase("idle");
  setDownloadingModelId(null);
  setError(null);
  setCurrentOperation(null);
  setAnalyzeAllCancelled(false);
}
