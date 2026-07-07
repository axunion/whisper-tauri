import { invoke } from "@tauri-apps/api/core";
import type { Accessor } from "solid-js";
import { createSignal, onCleanup } from "solid-js";
import { parseError } from "~/lib/errors";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type {
  AiContent,
  AiContentType,
  InferenceProgress,
  StructuredSummary,
} from "~/types";
import type { AppError } from "~/types/errors";

export type AiOperation = "summary" | "cleanText" | null;

export interface AiSession {
  // State
  summaryResult: Accessor<StructuredSummary | null>;
  cleanTextResult: Accessor<string | null>;
  titleResult: Accessor<string | null>;
  isProcessing: Accessor<boolean>;
  isGeneratingTitle: Accessor<boolean>;
  isLoaded: Accessor<boolean>;
  currentOperation: Accessor<AiOperation>;
  inferenceProgress: Accessor<InferenceProgress | null>;
  error: Accessor<AppError | null>;

  // Actions
  summarize: (text: string) => Promise<StructuredSummary | null>;
  cleanText: (text: string) => Promise<string | null>;
  generateTitle: (text: string) => Promise<string | null>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

/**
 * Parses persisted summary content from the history DB.
 *
 * History stores summaries as JSON strings under `ai_content.text`. When the
 * stored value cannot be parsed (corrupted entry, or a legacy plain-text
 * summary written before structured output landed), we surface the raw text
 * inside `tldr` so the user can still see what was saved.
 */
export function parseSummaryContent(text: string): StructuredSummary {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const tldrRaw = parsed.tldr;
      return {
        headline: typeof parsed.headline === "string" ? parsed.headline : "",
        // Tolerate older entries that stored tldr as an array.
        tldr:
          typeof tldrRaw === "string"
            ? tldrRaw
            : Array.isArray(tldrRaw)
              ? tldrRaw
                  .filter((x): x is string => typeof x === "string")
                  .join(" ")
              : "",
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.filter((x): x is string => typeof x === "string")
          : [],
        actionItems: Array.isArray(parsed.actionItems)
          ? (parsed.actionItems as StructuredSummary["actionItems"])
          : [],
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.filter((x): x is string => typeof x === "string")
          : [],
      };
    }
  } catch {
    // Fall through to plain-text fallback.
  }
  return {
    headline: "",
    tldr: text,
    keywords: [],
    actionItems: [],
    keyPoints: [],
  };
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

  const [summaryResult, setSummaryResult] =
    createSignal<StructuredSummary | null>(null);
  const [cleanTextResult, setCleanTextResult] = createSignal<string | null>(
    null,
  );
  const [titleResult, setTitleResult] = createSignal<string | null>(null);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = createSignal(false);
  const [currentOperation, setCurrentOperation] =
    createSignal<AiOperation>(null);
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
          setSummaryResult(parseSummaryContent(c.text));
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
        ...(optionsJson !== undefined && { optionsJson }),
        textModelId: modelId,
      },
    }).catch(console.error);
  }

  async function runExtraction<TResult>(
    command: string,
    contentType: AiContentType,
    operation: "summary" | "cleanText",
    setResult: (v: TResult | null) => void,
    text: string,
    serialize: (value: TResult) => string,
  ): Promise<TResult | null> {
    if (isProcessing()) return null;
    setIsProcessing(true);
    setCurrentOperation(operation);
    setError(null);
    try {
      const modelId = tp.effectiveModelId();
      const result = await invoke<TResult>(command, { text, modelId });
      setResult(result);
      if (result !== null && result !== undefined) {
        saveToHistory(contentType, serialize(result), modelId ?? "unknown");
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

  async function summarize(text: string): Promise<StructuredSummary | null> {
    return runExtraction<StructuredSummary>(
      "text_processing_summarize",
      "summary",
      "summary",
      setSummaryResult,
      text,
      JSON.stringify,
    );
  }

  async function cleanText(text: string): Promise<string | null> {
    return runExtraction<string>(
      "text_processing_clean_text",
      "cleanText",
      "cleanText",
      setCleanTextResult,
      text,
      (v) => v,
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
