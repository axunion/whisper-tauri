import { invoke } from "@tauri-apps/api/core";
import type { Accessor } from "solid-js";
import { createSignal, onCleanup } from "solid-js";
import { parseError } from "~/lib/errors";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type { AiContent, AiContentType, InferenceProgress } from "~/types";
import type { AppError } from "~/types/errors";

export interface AiSession {
  // State
  summaryResult: Accessor<string | null>;
  cleanTextResult: Accessor<string | null>;
  titleResult: Accessor<string | null>;
  isProcessing: Accessor<boolean>;
  isGeneratingTitle: Accessor<boolean>;
  isLoaded: Accessor<boolean>;
  currentOperation: Accessor<"summary" | "cleanText" | null>;
  inferenceProgress: Accessor<InferenceProgress | null>;
  error: Accessor<AppError | null>;

  // Actions
  summarize: (text: string) => Promise<string | null>;
  cleanText: (text: string) => Promise<string | null>;
  generateTitle: (text: string) => Promise<string | null>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

/**
 * Per-context AI session factory.
 * Each call creates an independent set of signals and actions scoped to a
 * specific history item (or a fresh transcription where historyId is initially undefined).
 */
export function createAiSession(
  historyIdGetter: () => string | undefined,
): AiSession {
  const tp = createTextProcessing();

  const [summaryResult, setSummaryResult] = createSignal<string | null>(null);
  const [cleanTextResult, setCleanTextResult] = createSignal<string | null>(
    null,
  );
  const [titleResult, setTitleResult] = createSignal<string | null>(null);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = createSignal(false);
  const [currentOperation, setCurrentOperation] = createSignal<
    "summary" | "cleanText" | null
  >(null);
  const [error, setError] = createSignal<AppError | null>(null);
  const [isLoaded, setIsLoaded] = createSignal(false);

  const inferenceProgress = (): InferenceProgress | null =>
    isProcessing() ? tp.inferenceProgress() : null;

  onCleanup(() => {
    if (isProcessing()) {
      cancelSession().catch(console.error);
    }
  });

  function loadFromAiContent(content: AiContent[]): void {
    for (const c of content) {
      switch (c.contentType) {
        case "summary":
          setSummaryResult(c.text);
          break;
        case "cleanText":
          setCleanTextResult(c.text);
          break;
        case "title":
          setTitleResult(c.text);
          break;
      }
    }
  }

  async function loadFromDb(): Promise<void> {
    const hid = historyIdGetter();
    if (!hid) {
      setIsLoaded(true);
      return;
    }
    try {
      const content = await invoke<AiContent[]>("history_get_all_ai_content", {
        historyId: hid,
      });
      loadFromAiContent(content);
    } catch {
      // Best-effort: silently ignore load failures
    } finally {
      setIsLoaded(true);
    }
  }

  loadFromDb();

  function saveToHistory(
    contentType: AiContentType,
    text: string,
    modelId: string,
    optionsJson?: string,
  ): void {
    const historyId = historyIdGetter();
    if (!historyId) return;
    invoke("history_save_ai_content", {
      params: {
        historyId,
        contentType,
        text,
        optionsJson,
        textModelId: modelId,
      },
    }).catch(console.error);
  }

  async function runExtraction(
    command: string,
    contentType: AiContentType,
    operation: "summary" | "cleanText",
    setResult: (v: string | null) => void,
    text: string,
  ): Promise<string | null> {
    if (isProcessing()) return null;
    setIsProcessing(true);
    setCurrentOperation(operation);
    setResult(null);
    setError(null);
    try {
      const modelId = tp.effectiveModelId();
      const result = await invoke<string>(command, { text, modelId });
      setResult(result);
      if (result) {
        saveToHistory(contentType, result, modelId ?? "unknown");
      }
      return result;
    } catch (e) {
      setError(parseError(e));
      return null;
    } finally {
      setCurrentOperation(null);
      setIsProcessing(false);
    }
  }

  async function summarize(text: string): Promise<string | null> {
    return runExtraction(
      "text_processing_summarize",
      "summary",
      "summary",
      setSummaryResult,
      text,
    );
  }

  async function cleanText(text: string): Promise<string | null> {
    return runExtraction(
      "text_processing_clean_text",
      "cleanText",
      "cleanText",
      setCleanTextResult,
      text,
    );
  }

  async function generateTitle(text: string): Promise<string | null> {
    if (isGeneratingTitle()) return null;
    setIsGeneratingTitle(true);
    try {
      const result = await tp.generateTitle(text);
      if (result) {
        setTitleResult(result);
        saveToHistory("title", result, tp.effectiveModelId() ?? "unknown");
      }
      return result;
    } catch (e) {
      setError(parseError(e));
      return null;
    } finally {
      setIsGeneratingTitle(false);
    }
  }

  async function cancelSession(): Promise<void> {
    const progress = tp.inferenceProgress();
    if (progress) {
      await invoke("text_processing_cancel", { taskId: progress.taskId });
    }
  }

  function clearError(): void {
    setError(null);
  }

  return {
    summaryResult,
    cleanTextResult,
    titleResult,
    isProcessing,
    isGeneratingTitle,
    isLoaded,
    currentOperation,
    inferenceProgress,
    error,
    summarize,
    cleanText,
    generateTitle,
    cancel: cancelSession,
    clearError,
  };
}
