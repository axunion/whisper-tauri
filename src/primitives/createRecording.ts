import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import type { AudioDevice, RecordingLevel, RecordingStopResult } from "~/types";
import type { AppError } from "~/types/errors";

const {
  devices,
  setDevices,
  selectedDevice,
  setSelectedDevice,
  isRecording,
  setIsRecording,
  level,
  setLevel,
  tempFilePath,
  setTempFilePath,
  duration,
  setDuration,
  error,
  setError,
} = createRoot(() => {
  const [devices, setDevices] = createSignal<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = createSignal<AudioDevice | null>(
    null,
  );
  const [isRecording, setIsRecording] = createSignal(false);
  const [level, setLevel] = createSignal<RecordingLevel | null>(null);
  const [tempFilePath, setTempFilePath] = createSignal<string | null>(null);
  const [duration, setDuration] = createSignal(0);
  const [error, setError] = createSignal<AppError | null>(null);

  return {
    devices,
    setDevices,
    selectedDevice,
    setSelectedDevice,
    isRecording,
    setIsRecording,
    level,
    setLevel,
    tempFilePath,
    setTempFilePath,
    duration,
    setDuration,
    error,
    setError,
  };
});

listen<RecordingLevel>("recording:level", (event) => {
  setLevel(event.payload);
}).catch(console.error);

let durationTimer: ReturnType<typeof setInterval> | undefined;
// Guards the window between a stop request and the backend finishing the WAV,
// during which `isRecording` is still true.
let isStopping = false;

async function loadDevices(): Promise<void> {
  try {
    const result = await invoke<AudioDevice[]>("list_audio_devices");
    setDevices(result);
    if (!selectedDevice()) {
      const defaultDevice = result.find((d) => d.isDefault) ?? result[0];
      if (defaultDevice) setSelectedDevice(defaultDevice);
    }
  } catch (e) {
    setError(parseError(e));
  }
}

function selectDevice(device: AudioDevice): void {
  setSelectedDevice(device);
}

async function startRecording(): Promise<void> {
  if (isRecording()) return;
  setError(null);
  setTempFilePath(null);
  setDuration(0);
  setLevel(null);

  try {
    await invoke("start_recording", {
      deviceId: selectedDevice()?.id ?? null,
    });
    setIsRecording(true);
    durationTimer = setInterval(() => {
      setDuration((d) => d + 100);
    }, 100);
  } catch (e) {
    setError(parseError(e));
  }
}

async function stopRecording(): Promise<RecordingStopResult | null> {
  if (!isRecording() || isStopping) return null;
  isStopping = true;

  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = undefined;
  }

  try {
    const result = await invoke<RecordingStopResult>("stop_recording");
    setIsRecording(false);
    setTempFilePath(result.tempFilePath);
    setDuration(result.durationMs);
    setLevel(null);
    return result;
  } catch (e) {
    setIsRecording(false);
    setError(parseError(e));
    return null;
  } finally {
    isStopping = false;
  }
}

async function cleanup(): Promise<void> {
  const path = tempFilePath();
  if (!path) return;
  try {
    await invoke("cleanup_recording", { path });
    setTempFilePath(null);
  } catch (e) {
    setError(parseError(e));
  }
}

/** Lets go of the recording without deleting it — its file now lives elsewhere. */
function release(): void {
  setTempFilePath(null);
}

function clearError(): void {
  setError(null);
}

const recordingInstance = {
  devices,
  selectedDevice,
  isRecording,
  level,
  tempFilePath,
  duration,
  error,
  loadDevices,
  selectDevice,
  startRecording,
  stopRecording,
  cleanup,
  release,
  clearError,
};

export function createRecording() {
  return recordingInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetRecordingForTesting(): void {
  setDevices([]);
  setSelectedDevice(null);
  setIsRecording(false);
  setLevel(null);
  setTempFilePath(null);
  setDuration(0);
  setError(null);
  isStopping = false;
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = undefined;
  }
}
