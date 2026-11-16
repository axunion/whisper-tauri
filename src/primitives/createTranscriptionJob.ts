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

/** A history entry's kept recording, offered for another transcription. */
export interface AudioSource {
  /** The history entry the audio belongs to. */
  id: string;
  /** Path of its audio file. */
  path: string;
  /** Name to show for it and to save the new entry under. */
  name: string;
}

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
  attachError,
  setAttachError,
  audioSource,
  setAudioSource,
} = createRoot(() => {
  const converter = createFileConverter();
  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);
  const [historyId, setHistoryId] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<AppError | null>(null);
  const [attachError, setAttachError] = createSignal<AppError | null>(null);
  const [audioSource, setAudioSource] = createSignal<AudioSource | null>(null);
  return {
    converter,
    convertedPath,
    setConvertedPath,
    historyId,
    setHistoryId,
    saveError,
    setSaveError,
    attachError,
    setAttachError,
    audioSource,
    setAudioSource,
  };
});

function phase(): JobPhase {
  if (whisper.result()) return "done";
  if (whisper.isProcessing()) return "processing";
  if (converter.isConverting()) return "converting";
  return "idle";
}

function isRunning(): boolean {
  const current = phase();
  return current === "converting" || current === "processing";
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
  return converter.error() ?? saveError() ?? attachError();
}

/**
 * True when the run produced a result that could not be written to history.
 * Starting over is the wrong remedy for that: it would discard the result to
 * redo minutes of work for one database write.
 */
function saveFailed(): boolean {
  return saveError() !== null;
}

/**
 * True when the entry was saved but its recording could not be attached as
 * audio. Like a failed save, starting over does not fix it — and would write
 * a second entry.
 */
function attachFailed(): boolean {
  return attachError() !== null;
}

function clearError(): void {
  converter.clearError();
  setSaveError(null);
  setAttachError(null);
}

async function cleanupConverted(): Promise<void> {
  const path = convertedPath();
  if (!path) return;
  await converter.cleanup(path);
  setConvertedPath(null);
}

/** Returns the new history entry's id, or null if the result was not saved. */
async function saveToHistory(
  fileName: string,
  source: HistorySource,
  completedMessage: string,
): Promise<string | null> {
  const result = whisper.result();
  const model = whisper.selectedModel();
  if (!result || !model) return null;

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
  let id: string;
  try {
    id = await invoke<string>("history_save", { params });
  } catch (e) {
    // Reported instead of the completion toast: announcing success would tell
    // the user the result is safe when it is not in history.
    setSaveError(parseError(e));
    return null;
  }
  setHistoryId(id);
  toast.success(completedMessage);
  return id;
}

/** Clears what the previous run left behind before a new one starts. */
function beginRun(): void {
  setSaveError(null);
  setAttachError(null);
  // Dropped up front: the result view mounts as soon as the result arrives,
  // before the new entry is saved, so a stale id would load the previous
  // transcription's AI content and persist this run's summary onto it.
  setHistoryId(null);
}

async function startFile(options: StartOptions): Promise<void> {
  const file = whisper.file();
  if (!file || !canStartFile()) return;
  // Captured with the file: both describe this run, and either can be
  // replaced from another page while the transcription is in flight. The path
  // check drops a source the user has since picked a different file over.
  const pending = audioSource();
  const source = pending?.path === file.path ? pending : null;
  beginRun();
  await cleanupConverted();

  // Decided by the path, not the display name: a kept recording is shown
  // under its history title, which has no extension.
  if (file.path.toLowerCase().endsWith(".wav")) {
    await whisper.startTranscription();
  } else {
    const converted = await converter.convert(file.path);
    if (!converted) return;
    setConvertedPath(converted.outputPath);
    await whisper.startTranscription(converted.outputPath);
  }

  if (!source) {
    await saveToHistory(file.name, "file", options.completedMessage);
    return;
  }
  // A re-transcription of a kept recording is still a recording, and the new
  // entry gets its own copy of the audio.
  const id = await saveToHistory(
    file.name,
    "recording",
    options.completedMessage,
  );
  if (!id) return;
  try {
    await invoke("history_copy_audio", { fromId: source.id, toId: id });
  } catch (e) {
    setAttachError(parseError(e));
  }
}

/**
 * Selects a history entry's kept recording as the file to transcribe. Ignored
 * while a run is in flight — callers gate on `isRunning`.
 */
async function prepareRetranscription(source: AudioSource): Promise<void> {
  // Selecting a file mid-run would relabel the run in flight.
  if (isRunning()) return;
  // A finished result still on screen would hide the new selection.
  if (phase() === "done") await reset();
  setAudioSource(source);
  await whisper.selectFile({ path: source.path, name: source.name, size: 0 });
}

async function startRecording(options: StartRecordingOptions): Promise<void> {
  const tempPath = recording.tempFilePath();
  if (!tempPath || !canStartRecording()) return;
  beginRun();

  whisper.setFile({ path: tempPath, name: options.name, size: 0 });
  await whisper.startTranscription(tempPath);

  const id = await saveToHistory(
    options.name,
    "recording",
    options.completedMessage,
  );
  // On cancel or failure the WAV stays where it is: it is the user's only
  // copy, and "Save as WAV" must remain reachable.
  if (!id) return;

  // The WAV becomes the entry's audio. If the move fails it is still an
  // untranscribed recording as far as the UI goes, so nothing is lost.
  try {
    await invoke("history_attach_recording", { id, recordingPath: tempPath });
    recording.release();
  } catch (e) {
    setAttachError(parseError(e));
  }
}

/** Leaves the result view and returns to an empty input. */
async function reset(): Promise<void> {
  await cleanupConverted();
  setHistoryId(null);
  setSaveError(null);
  setAttachError(null);
  setAudioSource(null);
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
  isRunning,
  historyId,
  error,
  saveFailed,
  attachFailed,
  canStartFile,
  canStartRecording,
  startFile,
  startRecording,
  prepareRetranscription,
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
  setAttachError(null);
  setAudioSource(null);
}
