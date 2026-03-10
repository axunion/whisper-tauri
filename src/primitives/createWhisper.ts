import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { batch, createSignal, onCleanup } from "solid-js";
import { parseError } from "../lib/errors";
import type {
  DownloadProgress,
  FileInfo,
  ModelInfo,
  TranscriptionProgress,
  TranscriptionResult,
} from "../types";
import type { AppError } from "../types/errors";

export function createWhisper() {
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
  const [error, setError] = createSignal<AppError | null>(null);

  // Internal state for cancellation
  const [currentTaskId, setCurrentTaskId] = createSignal<string | null>(null);

  // Event listeners with cleanup
  let unlistenProgress: (() => void) | undefined;
  let unlistenDownload: (() => void) | undefined;

  listen<TranscriptionProgress>("whisper:progress", (event) => {
    setProgress(event.payload);
    setCurrentTaskId(event.payload.taskId);
  }).then((fn) => {
    unlistenProgress = fn;
  });

  listen<DownloadProgress>("model:download-progress", (event) => {
    setDownloadProgress(event.payload);
  }).then((fn) => {
    unlistenDownload = fn;
  });

  onCleanup(() => {
    unlistenProgress?.();
    unlistenDownload?.();
  });

  async function loadModels(): Promise<void> {
    try {
      const result = await invoke<ModelInfo[]>("get_available_models");
      setModels(result);
      autoSelectModel();
    } catch (e) {
      setError(parseError(e));
    }
  }

  function autoSelectModel(): void {
    if (selectedModel()) return;
    const downloaded = models().filter((m) => m.downloaded);
    const pick = downloaded.find((m) => m.recommended) ?? downloaded[0];
    if (pick) {
      setSelectedModel(pick);
    }
  }

  function selectModel(model: ModelInfo): void {
    if (!model.downloaded) return;
    setSelectedModel(model);
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
    } catch (e) {
      setError(parseError(e));
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
    });
    try {
      const transcriptionResult = await invoke<TranscriptionResult>(
        "transcribe_audio",
        {
          audioPath: overrideAudioPath ?? currentFile.path,
          modelPath: currentModel.path,
          language: language(),
        },
      );
      setResult(transcriptionResult);
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

  return {
    // State (Accessors)
    models,
    selectedModel,
    file,
    language,
    progress,
    downloadProgress,
    result,
    isProcessing,
    isDownloading,
    error,

    // Actions
    loadModels,
    selectModel,
    setFile,
    setLanguage,
    downloadModel,
    deleteModel,
    startTranscription,
    cancelTranscription,
    reset,
    clearError,
  };
}
