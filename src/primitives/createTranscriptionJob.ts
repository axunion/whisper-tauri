import { invoke } from "@tauri-apps/api/core";
import { createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import { toast } from "~/lib/toast";
import { createFileConverter } from "~/primitives/createFileConverter";
import { createRecording } from "~/primitives/createRecording";
import { createWhisper } from "~/primitives/createWhisper";
import type { HistorySaveParams, HistorySource } from "~/types";
import type { AppError } from "~/types/errors";

type JobPhase = "idle" | "converting" | "processing" | "done";

interface StartOptions {
  /** Toast shown once the result is safely in history. */
  completedMessage: string;
}

interface StartRecordingOptions extends StartOptions {
  /** History entry name for the recording. */
  name: string;
}

const whisper = createWhisper();
const recording = createRecording();

const {
  converter,
  convertedPath,
  setConvertedPath,
  historyId,
  setHistoryId,
  saveError,
  setSaveError,
} = createRoot(() => {
  const converter = createFileConverter();
  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);
  const [historyId, setHistoryId] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<AppError | null>(null);
  return {
    converter,
    convertedPath,
    setConvertedPath,
    historyId,
    setHistoryId,
    saveError,
    setSaveError,
  };
});

function phase(): JobPhase {
  if (whisper.result()) return "done";
  if (whisper.isProcessing()) return "processing";
  if (converter.isConverting()) return "converting";
  return "idle";
}

function canStartFile(): boolean {
  return (
    whisper.file() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing() &&
    !converter.isConverting()
  );
}

function canStartRecording(): boolean {
  return (
    recording.tempFilePath() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing()
  );
}

function error(): AppError | null {
  return converter.error() ?? saveError();
}

/**
 * True when the run produced a result that could not be written to history.
 * Starting over is the wrong remedy for that: it would discard the result to
 * redo minutes of work for one database write.
 */
function saveFailed(): boolean {
  return saveError() !== null;
}

function clearError(): void {
  converter.clearError();
  setSaveError(null);
}

async function cleanupConverted(): Promise<void> {
  const path = convertedPath();
  if (!path) return;
  await converter.cleanup(path);
  setConvertedPath(null);
}

/** Returns whether the result was written to history. */
async function saveToHistory(
  fileName: string,
  source: HistorySource,
  completedMessage: string,
): Promise<boolean> {
  const result = whisper.result();
  const model = whisper.selectedModel();
  if (!result || !model) return false;

  const params: HistorySaveParams = {
    fileName,
    language: result.language,
    modelId: model.id,
    duration: result.duration,
    text: result.text,
    segments: result.segments,
    vadEnabled: whisper.vadEnabled(),
    source,
  };
  try {
    setHistoryId(await invoke<string>("history_save", { params }));
  } catch (e) {
    // Reported instead of the completion toast: announcing success would tell
    // the user the result is safe when it is not in history.
    setSaveError(parseError(e));
    return false;
  }
  toast.success(completedMessage);
  return true;
}

/** Clears what the previous run left behind before a new one starts. */
function beginRun(): void {
  setSaveError(null);
  // Dropped up front: the result view mounts as soon as the result arrives,
  // before the new entry is saved, so a stale id would load the previous
  // transcription's AI content and persist this run's summary onto it.
  setHistoryId(null);
}

async function startFile(options: StartOptions): Promise<void> {
  const file = whisper.file();
  if (!file || !canStartFile()) return;
  beginRun();
  await cleanupConverted();

  if (file.name.toLowerCase().endsWith(".wav")) {
    await whisper.startTranscription();
  } else {
    const converted = await converter.convert(file.path);
    if (!converted) return;
    setConvertedPath(converted.outputPath);
    await whisper.startTranscription(converted.outputPath);
  }

  await saveToHistory(file.name, "file", options.completedMessage);
}

async function startRecording(options: StartRecordingOptions): Promise<void> {
  const tempPath = recording.tempFilePath();
  if (!tempPath || !canStartRecording()) return;
  beginRun();

  whisper.setFile({ path: tempPath, name: options.name, size: 0 });
  await whisper.startTranscription(tempPath);

  const saved = await saveToHistory(
    options.name,
    "recording",
    options.completedMessage,
  );

  // Only discard the recording once its transcription is safely in history.
  // On cancel or failure the WAV is the user's only copy — deleting it here
  // would make "Save as WAV" unreachable and lose the audio for good.
  if (saved) {
    await recording.cleanup();
  }
}

/** Leaves the result view and returns to an empty input. */
async function reset(): Promise<void> {
  await cleanupConverted();
  setHistoryId(null);
  setSaveError(null);
  whisper.reset();
}

async function discardRecording(): Promise<void> {
  await recording.cleanup();
  setHistoryId(null);
  whisper.reset();
}

/**
 * The whole run behind "Start transcription": convert if needed, transcribe,
 * save to history, clean up.
 *
 * Module-level singleton, like the whisper state it drives: a run keeps going
 * when the user leaves the transcription page, so its steps cannot live in a
 * component that unmounts midway.
 */
const jobInstance = {
  phase,
  historyId,
  error,
  saveFailed,
  canStartFile,
  canStartRecording,
  startFile,
  startRecording,
  reset,
  discardRecording,
  clearError,
};

export function createTranscriptionJob() {
  return jobInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetTranscriptionJobForTesting(): void {
  converter.clearError();
  setConvertedPath(null);
  setHistoryId(null);
  setSaveError(null);
}
