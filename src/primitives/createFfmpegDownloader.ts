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
  isSystemAvailable,
  setIsSystemAvailable,
  isDownloading,
  setIsDownloading,
  downloadProgress,
  setDownloadProgress,
  error,
  setError,
} = createRoot(() => {
  const [isBundled, setIsBundled] = createSignal(false);
  const [isSystemAvailable, setIsSystemAvailable] = createSignal(false);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] =
    createSignal<FfmpegDownloadProgress | null>(null);
  const [error, setError] = createSignal<AppError | null>(null);

  return {
    isBundled,
    setIsBundled,
    isSystemAvailable,
    setIsSystemAvailable,
    isDownloading,
    setIsDownloading,
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

async function checkStatus(): Promise<void> {
  try {
    const [bundled, available] = await Promise.all([
      invoke<boolean>("check_ffmpeg_bundled"),
      invoke<boolean>("check_ffmpeg_available"),
    ]);
    setIsBundled(bundled);
    setIsSystemAvailable(available && !bundled);
  } catch (e) {
    setError(parseError(e));
  }
}

async function download(): Promise<void> {
  if (isDownloading()) return;
  setIsDownloading(true);
  setError(null);
  try {
    await invoke<string>("download_ffmpeg");
    setIsBundled(true);
    setIsSystemAvailable(false);
  } catch (e) {
    setError(parseError(e));
  } finally {
    setIsDownloading(false);
  }
}

async function getDownloadUrl(): Promise<string | null> {
  try {
    return await invoke<string | null>("get_ffmpeg_download_url");
  } catch (e) {
    setError(parseError(e));
    return null;
  }
}

async function setDownloadUrl(url: string | null): Promise<void> {
  try {
    await invoke("set_ffmpeg_download_url", { url });
  } catch (e) {
    setError(parseError(e));
  }
}

async function deleteBundled(): Promise<void> {
  try {
    await invoke("delete_ffmpeg");
    setIsBundled(false);
    // Re-check if system ffmpeg is available
    const available = await invoke<boolean>("check_ffmpeg_available");
    setIsSystemAvailable(available);
  } catch (e) {
    setError(parseError(e));
  }
}

function clearError(): void {
  setError(null);
}

const ffmpegDownloaderInstance = {
  // State (Accessors)
  isBundled,
  isSystemAvailable,
  isDownloading,
  downloadProgress,
  error,

  // Actions
  checkStatus,
  download,
  deleteBundled,
  getDownloadUrl,
  setDownloadUrl,
  clearError,
};

export function createFfmpegDownloader() {
  return ffmpegDownloaderInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetFfmpegDownloaderForTesting(): void {
  setIsBundled(false);
  setIsSystemAvailable(false);
  setIsDownloading(false);
  setDownloadProgress(null);
  setError(null);
}
