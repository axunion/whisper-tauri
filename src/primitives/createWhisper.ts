import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { batch, createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import { sumDownloadedBytes } from "~/lib/format";
import { createSettings } from "~/primitives/createSettings";
import type {
  DownloadProgress,
  FileInfo,
  ModelInfo,
  TranscriptionProgress,
  TranscriptionResult,
} from "~/types";
import type { AppError } from "~/types/errors";

// Module-level singleton state — all consumers share the same signals.
const {
  models,
  setModels,
  selectedModel,
  setSelectedModel,
  file,
  setFile,
  progress,
  setProgress,
  downloadProgress,
  setDownloadProgress,
  result,
  setResult,
  isProcessing,
  setIsProcessing,
  isDownloading,
  setIsDownloading,
  language,
  setLanguage,
  vadEnabledOverride,
  setVadEnabledOverride,
  error,
  setError,
  currentTaskId,
  setCurrentTaskId,
  processingMs,
  setProcessingMs,
  transcribedAt,
  setTranscribedAt,
} = createRoot(() => {
  const [models, setModels] = createSignal<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = createSignal<ModelInfo | null>(
    null,
  );
  const [file, setFile] = createSignal<FileInfo | null>(null);
  const [progress, setProgress] = createSignal<TranscriptionProgress | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] =
    createSignal<DownloadProgress | null>(null);
  const [result, setResult] = createSignal<TranscriptionResult | null>(null);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [language, setLanguage] = createSignal<string | null>(null);
  const [vadEnabledOverride, setVadEnabledOverride] = createSignal<
    boolean | null
  >(null);
  const [error, setError] = createSignal<AppError | null>(null);

  // Internal state for cancellation
  const [currentTaskId, setCurrentTaskId] = createSignal<string | null>(null);

  // Wall-clock duration of the most recent transcription, in milliseconds.
  // Null until the first run completes; persists across resets so the latest
  // result's timing remains available for Notion meta until a new run starts.
  const [processingMs, setProcessingMs] = createSignal<number | null>(null);

  // ISO timestamp captured when the most recent transcription completed. The
  // history record's `createdAt` will differ by milliseconds (server-time);
  // this value is the live-side surrogate for the Notion meta callout.
  const [transcribedAt, setTranscribedAt] = createSignal<string | null>(null);

  return {
    models,
    setModels,
    selectedModel,
    setSelectedModel,
    file,
    setFile,
    progress,
    setProgress,
    downloadProgress,
    setDownloadProgress,
    result,
    setResult,
    isProcessing,
    setIsProcessing,
    isDownloading,
    setIsDownloading,
    language,
    setLanguage,
    vadEnabledOverride,
    setVadEnabledOverride,
    error,
    setError,
    currentTaskId,
    setCurrentTaskId,
    processingMs,
    setProcessingMs,
    transcribedAt,
    setTranscribedAt,
  };
});

// Event listeners at module level — persist for the app lifetime.
listen<TranscriptionProgress>("whisper:progress", (event) => {
  setProgress(event.payload);
  setCurrentTaskId(event.payload.taskId);
}).catch(console.error);

listen<DownloadProgress>("model:download-progress", (event) => {
  setDownloadProgress(event.payload);
}).catch(console.error);

function vadEnabled(): boolean {
  return vadEnabledOverride() ?? createSettings().vadEnabled();
}

function setVadEnabled(enabled: boolean): void {
  setVadEnabledOverride(enabled);
}

function autoSelectModel(): void {
  if (selectedModel()) return;
  const downloaded = models().filter((m) => m.downloaded);
  // Restore from settings if available
  const savedId = createSettings().whisperModelId();
  if (savedId) {
    const saved = downloaded.find((m) => m.id === savedId);
    if (saved) {
      setSelectedModel(saved);
      return;
    }
  }
  const pick = downloaded[0];
  if (pick) {
    setSelectedModel(pick);
  }
}

async function loadModels(): Promise<void> {
  try {
    const res = await invoke<ModelInfo[]>("get_available_models");
    setModels(res);
    autoSelectModel();
  } catch (e) {
    setError(parseError(e));
  }
}

function totalSizeBytes(): number {
  return sumDownloadedBytes(models());
}

function selectModel(model: ModelInfo): void {
  if (!model.downloaded) return;
  setSelectedModel(model);
  createSettings().update({ whisperModelId: model.id });
}

async function downloadModel(modelId: string): Promise<void> {
  if (isDownloading()) return;
  setIsDownloading(true);
  try {
    await invoke("download_model", { modelId });
    await loadModels();
  } catch (e) {
    setError(parseError(e));
  } finally {
    setIsDownloading(false);
  }
}

async function deleteModel(modelId: string): Promise<void> {
  try {
    await invoke("delete_model", { modelId });
    const wasSelected = selectedModel()?.id === modelId;
    if (wasSelected) {
      setSelectedModel(null);
    }
    await loadModels();
    // autoSelectModel (called by loadModels) picks the next model when
    // selectedModel is null, then we sync the choice back to settings.
    if (wasSelected) {
      createSettings().update({
        whisperModelId: selectedModel()?.id ?? null,
      });
    }
  } catch (e) {
    setError(parseError(e));
  }
}

async function selectFile(fileInfo: FileInfo): Promise<void> {
  setFile(fileInfo);

  // Fetch duration asynchronously — non-critical, UI works without it
  const filePath = fileInfo.path;
  try {
    const duration = await invoke<number>("get_audio_duration", { filePath });
    // Only update if the file hasn't changed while we were fetching
    const current = file();
    if (current?.path === filePath) {
      setFile({ ...current, duration });
    }
  } catch (e) {
    console.warn("Could not get audio duration:", e);
  }
}

async function startTranscription(overrideAudioPath?: string): Promise<void> {
  const currentFile = file();
  const currentModel = selectedModel();
  if (!currentFile || !currentModel) return;
  if (isProcessing()) return;

  batch(() => {
    setProgress(null);
    setResult(null);
    setIsProcessing(true);
    setProcessingMs(null);
    setTranscribedAt(null);
  });
  const startedAt = Date.now();
  try {
    let vadModelPath: string | null = null;
    if (vadEnabled()) {
      vadModelPath = await invoke<string>("ensure_vad_model");
    }

    const transcriptionResult = await invoke<TranscriptionResult>(
      "transcribe_audio",
      {
        audioPath: overrideAudioPath ?? currentFile.path,
        modelPath: currentModel.path,
        language: language(),
        vadModelPath,
      },
    );
    batch(() => {
      setResult(transcriptionResult);
      setProcessingMs(Date.now() - startedAt);
      setTranscribedAt(new Date().toISOString());
    });
  } catch (e) {
    setError(parseError(e));
  } finally {
    setIsProcessing(false);
  }
}

async function cancelTranscription(): Promise<void> {
  const taskId = currentTaskId();
  if (!taskId) return;
  await invoke("cancel_transcription", { taskId });
}

function reset(): void {
  setFile(null);
  setResult(null);
  setError(null);
}

function clearError(): void {
  setError(null);
}

const whisperInstance = {
  // State (Accessors)
  models,
  totalSizeBytes,
  selectedModel,
  file,
  language,
  vadEnabled,
  progress,
  downloadProgress,
  result,
  isProcessing,
  isDownloading,
  error,
  processingMs,
  transcribedAt,

  // Actions
  loadModels,
  selectModel,
  selectFile,
  setFile,
  setLanguage,
  setVadEnabled,
  downloadModel,
  deleteModel,
  startTranscription,
  cancelTranscription,
  reset,
  clearError,
};

export function createWhisper() {
  return whisperInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetWhisperForTesting(): void {
  setModels([]);
  setSelectedModel(null);
  setFile(null);
  setProgress(null);
  setDownloadProgress(null);
  setResult(null);
  setIsProcessing(false);
  setIsDownloading(false);
  setLanguage(null);
  setVadEnabledOverride(null);
  setError(null);
  setCurrentTaskId(null);
  setProcessingMs(null);
  setTranscribedAt(null);
}
