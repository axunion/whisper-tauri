import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import type { FfmpegDownloadProgress } from "~/types";
import type { AppError } from "~/types/errors";

// Module-level singleton state — all consumers share the same signals.
const {
  isBundled,
  setIsBundled,
  isDownloading,
  setIsDownloading,
  needsUpdate,
  setNeedsUpdate,
  downloadProgress,
  setDownloadProgress,
  error,
  setError,
} = createRoot(() => {
  const [isBundled, setIsBundled] = createSignal(false);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [needsUpdate, setNeedsUpdate] = createSignal(false);
  const [downloadProgress, setDownloadProgress] =
    createSignal<FfmpegDownloadProgress | null>(null);
  const [error, setError] = createSignal<AppError | null>(null);

  return {
    isBundled,
    setIsBundled,
    isDownloading,
    setIsDownloading,
    needsUpdate,
    setNeedsUpdate,
    downloadProgress,
    setDownloadProgress,
    error,
    setError,
  };
});

// Event listener at module level — persists for the app lifetime.
listen<FfmpegDownloadProgress>("ffmpeg:download-progress", (event) => {
  setDownloadProgress(event.payload);
}).catch(console.error);

// Load-once guard for the on-disk status probe. `statusChecked` flips only on
// success and the in-flight promise is released either way, so a transient IPC
// failure still retries on the next call.
let statusChecked = false;
let checkStatusPromise: Promise<void> | null = null;

async function fetchStatus(): Promise<void> {
  try {
    const [bundled, update] = await Promise.all([
      invoke<boolean>("check_ffmpeg_bundled"),
      invoke<boolean>("check_ffmpeg_needs_update"),
    ]);
    setIsBundled(bundled);
    setNeedsUpdate(update);
    statusChecked = true;
  } catch (e) {
    setError(parseError(e));
  }
}

async function checkStatus(): Promise<void> {
  if (statusChecked) return;
  if (checkStatusPromise) return checkStatusPromise;
  checkStatusPromise = fetchStatus().finally(() => {
    checkStatusPromise = null;
  });
  return checkStatusPromise;
}

async function download(): Promise<boolean> {
  if (isDownloading()) return false;
  setIsDownloading(true);
  setError(null);
  try {
    await invoke<string>("download_ffmpeg");
    setIsBundled(true);
    setNeedsUpdate(false);
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  } finally {
    setIsDownloading(false);
  }
}

async function deleteBundled(): Promise<boolean> {
  try {
    await invoke("delete_ffmpeg");
    setIsBundled(false);
    setNeedsUpdate(false);
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  }
}

function clearError(): void {
  setError(null);
}

const ffmpegDownloaderInstance = {
  // State (Accessors)
  isBundled,
  isDownloading,
  needsUpdate,
  downloadProgress,
  error,

  // Actions
  checkStatus,
  download,
  deleteBundled,
  clearError,
};

export function createFfmpegDownloader() {
  return ffmpegDownloaderInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetFfmpegDownloaderForTesting(): void {
  statusChecked = false;
  checkStatusPromise = null;
  setIsBundled(false);
  setIsDownloading(false);
  setNeedsUpdate(false);
  setDownloadProgress(null);
  setError(null);
}
