import { createRoot, createSignal } from "solid-js";
import { commands } from "~/bindings";
import { extractFilename } from "~/lib/constants";
import { parseError } from "~/lib/errors";
import { notifyUnlessFocused } from "~/lib/notify";
import { toast } from "~/lib/toast";
import { createFileConverter } from "~/primitives/createFileConverter";
import { createRecording } from "~/primitives/createRecording";
import { createSettings } from "~/primitives/createSettings";
import { createWhisper } from "~/primitives/createWhisper";
import type { FileInfo, HistorySaveParams, HistorySource } from "~/types";
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

interface StartFileOptions extends StartOptions {
  /** Toast shown instead when the run covered several files. */
  batchCompletedMessage: (count: number) => string;
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
  queue,
  setQueue,
  batchIndex,
  setBatchIndex,
} = createRoot(() => {
  const converter = createFileConverter();
  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);
  const [historyId, setHistoryId] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<AppError | null>(null);
  const [attachError, setAttachError] = createSignal<AppError | null>(null);
  const [audioSource, setAudioSource] = createSignal<AudioSource | null>(null);
  // Files waiting behind the selected one; a file run works through them.
  const [queue, setQueue] = createSignal<FileInfo[]>([]);
  // 1-based position of the file being processed, while a file run is going.
  const [batchIndex, setBatchIndex] = createSignal<number | null>(null);
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
    queue,
    setQueue,
    batchIndex,
    setBatchIndex,
  };
});

function phase(): JobPhase {
  if (whisper.isProcessing()) return "processing";
  if (converter.isConverting()) return "converting";
  // Between two files of a run nothing is converting or transcribing, and the
  // previous file's result is still set; that gap is not "done".
  if (batchIndex() !== null) return "processing";
  if (whisper.result()) return "done";
  return "idle";
}

/** Position within a run over several files, or null for a single file. */
function batch(): { index: number; total: number } | null {
  const index = batchIndex();
  if (index === null) return null;
  const total = index + queue().length;
  return total > 1 ? { index, total } : null;
}

function isRunning(): boolean {
  const current = phase();
  return current === "converting" || current === "processing";
}

function canStartFile(): boolean {
  return (
    whisper.file() !== null && whisper.selectedModel() !== null && !isRunning()
  );
}

function canStartRecording(): boolean {
  return (
    recording.tempFilePath() !== null &&
    whisper.selectedModel() !== null &&
    !isRunning()
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

/**
 * The history entry whose audio a prepared or running re-transcription reads.
 * Deleting that entry or its audio meanwhile would break the run.
 *
 * Null once the user has moved the selection off that audio: the request is
 * then abandoned, and must not keep its entry undeletable.
 */
function audioSourceId(): string | null {
  const source = audioSource();
  return source && whisper.file()?.path === source.path ? source.id : null;
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

function announce(message: string, detail: string): void {
  toast.success(message);
  if (createSettings().notifyOnComplete()) {
    notifyUnlessFocused(message, detail).catch(console.error);
  }
}

/** Returns the new history entry's id, or null if the result was not saved. */
async function saveToHistory(
  fileName: string,
  source: HistorySource,
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
    id = await commands.historySave(params);
  } catch (e) {
    // The caller announces completion only for a saved result: announcing it
    // here would tell the user the result is safe when it is not in history.
    setSaveError(parseError(e));
    return null;
  }
  setHistoryId(id);
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

/**
 * Converts, transcribes and saves the selected file. Returns whether its
 * result reached history.
 */
async function runFile(
  file: FileInfo,
  source: AudioSource | null,
): Promise<boolean> {
  beginRun();
  await cleanupConverted();

  // Decided by the path, not the display name: a kept recording is shown
  // under its history title, which has no extension.
  if (file.path.toLowerCase().endsWith(".wav")) {
    await whisper.startTranscription();
  } else {
    const converted = await converter.convert(file.path);
    if (!converted) return false;
    setConvertedPath(converted.outputPath);
    await whisper.startTranscription(converted.outputPath);
  }

  if (!source) {
    return (await saveToHistory(file.name, "file")) !== null;
  }
  // A re-transcription of a kept recording is still a recording, and the new
  // entry gets its own copy of the audio.
  const id = await saveToHistory(file.name, "recording");
  if (!id) return false;
  try {
    await commands.historyCopyAudio(source.id, id);
  } catch (e) {
    setAttachError(parseError(e));
  }
  // Consumed. Until here it survives a cancelled or failed attempt, so that
  // starting again still produces a recording entry with its audio.
  setAudioSource(null);
  return true;
}

/**
 * Transcribes the selected file, then every queued one in order. A file that
 * fails or is cancelled stops the run with the rest still queued.
 */
async function startFile(options: StartFileOptions): Promise<void> {
  let file = whisper.file();
  if (!file || !canStartFile()) return;
  // Captured with the file: both describe this run, and either can be
  // replaced from another page while the transcription is in flight. The path
  // check drops a source the user has since picked a different file over.
  const pending = audioSource();
  let source = pending?.path === file.path ? pending : null;

  let saved = 0;
  let lastSavedName = "";
  // Cleared before the phase turns "processing": the progress view mounts on
  // that and must not anchor its clock on the previous run's last event.
  whisper.clearRun();
  setBatchIndex(1);
  try {
    while (file) {
      if (!(await runFile(file, source))) break;
      saved += 1;
      lastSavedName = file.name;
      // The next file would clear this error before anyone saw it.
      if (attachError()) break;

      const [next, ...rest] = queue();
      if (!next) break;
      setQueue(rest);
      // The previous file's result and progress must not outlive it: if this
      // file fails before transcription starts (a failed conversion), the
      // result view would show the previous text under this file's name.
      whisper.clearRun();
      void whisper.selectFile(next);
      file = next;
      source = null;
      setBatchIndex(saved + 1);
    }
  } finally {
    setBatchIndex(null);
  }

  // Announced once per run, and only for what reached history.
  if (saved === 1) {
    announce(options.completedMessage, lastSavedName);
  } else if (saved > 1) {
    announce(options.batchCompletedMessage(saved), lastSavedName);
  }
  // After several files there is no single result to show: they are all in
  // history. A run that stopped early keeps its state, so the error stays
  // visible; the files still queued come back when the result is closed.
  if (saved > 1 && whisper.result() && queue().length === 0 && !error()) {
    await reset();
  }
}

function toFileInfo(path: string): FileInfo {
  return { path, name: extractFilename(path), size: 0 };
}

/**
 * Adds files to transcribe: the first becomes the selected file when there is
 * none, the rest queue up behind it. Paths already selected or queued are
 * skipped. Files added while a run is in flight join that run.
 */
async function addFiles(paths: string[]): Promise<void> {
  // A finished result still on screen would hide the new selection.
  if (phase() === "done") await reset();

  const known = new Set(queue().map((f) => f.path));
  const selected = whisper.file();
  if (selected) known.add(selected.path);
  const fresh: string[] = [];
  for (const path of paths) {
    if (!known.has(path)) {
      known.add(path);
      fresh.push(path);
    }
  }

  const [first, ...rest] = fresh;
  if (!first) return;
  if (selected) {
    setQueue((q) => [...q, ...fresh.map(toFileInfo)]);
    return;
  }
  setQueue((q) => [...q, ...rest.map(toFileInfo)]);
  await whisper.selectFile(toFileInfo(first));
}

function removeQueued(path: string): void {
  setQueue((q) => q.filter((f) => f.path !== path));
}

/** Deselects the selected file; the next queued one takes its place. */
async function clearSelectedFile(): Promise<void> {
  const [next, ...rest] = queue();
  if (!next) {
    whisper.setFile(null);
    return;
  }
  setQueue(rest);
  await whisper.selectFile(next);
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
  requeueSelectedFile();
  setAudioSource(source);
  await whisper.selectFile({ path: source.path, name: source.name, size: 0 });
}

/**
 * Puts the selected file back at the head of the queue, for a run that is
 * about to take over the selection with something else.
 */
function requeueSelectedFile(): void {
  const selected = whisper.file();
  if (selected) setQueue((q) => [selected, ...q]);
}

async function startRecording(options: StartRecordingOptions): Promise<void> {
  const tempPath = recording.tempFilePath();
  if (!tempPath || !canStartRecording()) return;
  beginRun();
  requeueSelectedFile();

  whisper.setFile({ path: tempPath, name: options.name, size: 0 });
  await whisper.startTranscription(tempPath);

  const id = await saveToHistory(options.name, "recording");
  // On cancel or failure the WAV stays where it is: it is the user's only
  // copy, and "Save as WAV" must remain reachable.
  if (!id) return;
  announce(options.completedMessage, options.name);

  // The WAV becomes the entry's audio. If the move fails it is still an
  // untranscribed recording as far as the UI goes, so nothing is lost.
  try {
    await commands.historyAttachRecording(id, tempPath);
    recording.release();
  } catch (e) {
    setAttachError(parseError(e));
  }
}

/**
 * Leaves the result view and returns to the input. Files still queued — a run
 * that stopped early leaves them — stay, with the next one selected.
 */
async function reset(): Promise<void> {
  await cleanupConverted();
  setHistoryId(null);
  setSaveError(null);
  setAttachError(null);
  setAudioSource(null);
  whisper.reset();
  await clearSelectedFile();
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
  audioSourceId,
  canStartFile,
  canStartRecording,
  queue,
  batch,
  addFiles,
  removeQueued,
  clearSelectedFile,
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
  setQueue([]);
  setBatchIndex(null);
}
