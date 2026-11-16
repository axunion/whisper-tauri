import { createSignal } from "solid-js";
import { commands } from "~/bindings";
import { parseError } from "~/lib/errors";
import type { ConversionResult } from "~/types";
import type { AppError } from "~/types/errors";

export function createFileConverter() {
  const [isConverting, setIsConverting] = createSignal(false);
  const [error, setError] = createSignal<AppError | null>(null);

  async function convert(inputPath: string): Promise<ConversionResult | null> {
    setIsConverting(true);
    setError(null);
    try {
      const result = await commands.convertAudioFile(inputPath);
      return result;
    } catch (e) {
      setError(parseError(e));
      return null;
    } finally {
      setIsConverting(false);
    }
  }

  async function cleanup(filePath: string): Promise<void> {
    try {
      await commands.cleanupConvertedFile(filePath);
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
    cleanup,
    clearError,
  };
}
