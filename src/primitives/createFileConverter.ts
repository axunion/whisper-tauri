import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import type { ConversionResult, SupportedFormat } from "~/types";
import type { AppError } from "~/types/errors";

export function createFileConverter() {
  const [isConverting, setIsConverting] = createSignal(false);
  const [error, setError] = createSignal<AppError | null>(null);

  async function convert(inputPath: string): Promise<ConversionResult | null> {
    setIsConverting(true);
    setError(null);
    try {
      const result = await invoke<ConversionResult>("convert_audio_file", {
        inputPath,
      });
      return result;
    } catch (e) {
      setError(parseError(e));
      return null;
    } finally {
      setIsConverting(false);
    }
  }

  async function getSupportedFormats(): Promise<SupportedFormat[]> {
    try {
      return await invoke<SupportedFormat[]>("get_supported_formats");
    } catch (e) {
      setError(parseError(e));
      return [];
    }
  }

  async function cleanup(filePath: string): Promise<void> {
    try {
      await invoke("cleanup_converted_file", { filePath });
    } catch {
      // Cleanup failures are non-critical
    }
  }

  function clearError(): void {
    setError(null);
  }

  return {
    // State (Accessors)
    isConverting,
    error,

    // Actions
    convert,
    getSupportedFormats,
    cleanup,
    clearError,
  };
}
