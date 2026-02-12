import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createSignal, onCleanup } from "solid-js";
import type {
  DownloadProgress,
  FileInfo,
  ModelInfo,
  TranscriptionProgress,
  TranscriptionResult,
} from "../types";

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
  const [error, setError] = createSignal<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      await invoke("download_model", { model_id: modelId });
      await loadModels();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDownloading(false);
    }
  }

  async function startTranscription(): Promise<void> {
    const currentFile = file();
    const currentModel = selectedModel();
    if (!currentFile || !currentModel) return;
    if (isProcessing()) return;

    setIsProcessing(true);
    try {
      const transcriptionResult = await invoke<TranscriptionResult>(
        "transcribe_audio",
        {
          audio_path: currentFile.path,
          model_path: currentModel.path,
        },
      );
      setResult(transcriptionResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsProcessing(false);
    }
  }

  async function cancelTranscription(): Promise<void> {
    const taskId = currentTaskId();
    if (!taskId) return;
    await invoke("cancel_transcription", { task_id: taskId });
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
    downloadModel,
    startTranscription,
    cancelTranscription,
    reset,
    clearError,
  };
}
