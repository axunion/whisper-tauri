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
  keywordsResult: Accessor<string | null>;
  actionItemsResult: Accessor<string | null>;
  isProcessing: Accessor<boolean>;
  isLoaded: Accessor<boolean>;
  currentOperation: Accessor<"summary" | "keywords" | "actionItems" | null>;
  inferenceProgress: Accessor<InferenceProgress | null>;
  error: Accessor<AppError | null>;

  // Actions
  summarize: (text: string) => Promise<string | null>;
  extractKeywords: (text: string) => Promise<string | null>;
  extractActionItems: (text: string) => Promise<string | null>;
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
  const [keywordsResult, setKeywordsResult] = createSignal<string | null>(null);
  const [actionItemsResult, setActionItemsResult] = createSignal<string | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [currentOperation, setCurrentOperation] = createSignal<
    "summary" | "keywords" | "actionItems" | null
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
    const summary = content.find((c) => c.contentType === "summary");
    setSummaryResult(summary?.text ?? null);
    const keywords = content.find((c) => c.contentType === "keywords");
    setKeywordsResult(keywords?.text ?? null);
    const actionItems = content.find((c) => c.contentType === "actionItems");
    setActionItemsResult(actionItems?.text ?? null);
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
    operation: "summary" | "keywords" | "actionItems",
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

  async function extractKeywords(text: string): Promise<string | null> {
    return runExtraction(
      "text_processing_extract_keywords",
      "keywords",
      "keywords",
      setKeywordsResult,
      text,
    );
  }

  async function extractActionItems(text: string): Promise<string | null> {
    return runExtraction(
      "text_processing_extract_action_items",
      "actionItems",
      "actionItems",
      setActionItemsResult,
      text,
    );
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
    keywordsResult,
    actionItemsResult,
    isProcessing,
    isLoaded,
    currentOperation,
    inferenceProgress,
    error,
    summarize,
    extractKeywords,
    extractActionItems,
    cancel: cancelSession,
    clearError,
  };
}
