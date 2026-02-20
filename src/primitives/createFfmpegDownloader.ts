import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createSignal, onCleanup } from "solid-js";
import type { FfmpegDownloadProgress } from "../types";

export function createFfmpegDownloader() {
  const [isBundled, setIsBundled] = createSignal(false);
  const [isSystemAvailable, setIsSystemAvailable] = createSignal(false);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] =
    createSignal<FfmpegDownloadProgress | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Event listener with cleanup
  let unlistenProgress: (() => void) | undefined;

  listen<FfmpegDownloadProgress>("ffmpeg:download-progress", (event) => {
    setDownloadProgress(event.payload);
  }).then((fn) => {
    unlistenProgress = fn;
  });

  onCleanup(() => {
    unlistenProgress?.();
  });

  async function checkStatus(): Promise<void> {
    try {
      const [bundled, available] = await Promise.all([
        invoke<boolean>("check_ffmpeg_bundled"),
        invoke<boolean>("check_ffmpeg_available"),
      ]);
      setIsBundled(bundled);
      setIsSystemAvailable(available && !bundled);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDownloading(false);
    }
  }

  async function getDownloadUrl(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_ffmpeg_download_url");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  async function setDownloadUrl(url: string | null): Promise<void> {
    try {
      await invoke("set_ffmpeg_download_url", { url });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function clearError(): void {
    setError(null);
  }

  return {
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
}
