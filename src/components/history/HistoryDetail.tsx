import { invoke } from "@tauri-apps/api/core";
import { FiEdit2, FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { ResultViewer } from "~/components/transcription/ResultViewer";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import { formatDuration } from "~/lib/format";
import type { AiContent, HistoryEntry, TranscriptionResult } from "~/types";

interface HistoryDetailProps {
  entry: HistoryEntry;
  onRename?: (id: string, newFileName: string) => void;
  onClose?: () => void;
}

function toTranscriptionResult(entry: HistoryEntry): TranscriptionResult {
  return {
    taskId: entry.id,
    text: entry.text,
    segments: entry.segments,
    language: entry.language,
    duration: entry.duration,
  };
}

const HistoryDetail: Component<HistoryDetailProps> = (props) => {
  const { locale } = useI18n();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [aiContent, setAiContent] = createSignal<AiContent[]>([]);

  onMount(async () => {
    try {
      const content = await invoke<AiContent[]>("history_get_all_ai_content", {
        historyId: props.entry.id,
      });
      setAiContent(content);
    } catch {
      // Non-critical: silently ignore if AI content can't be loaded
    }
  });

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(locale() === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function startEditing(): void {
    setEditValue(props.entry.fileName);
    setIsEditing(true);
  }

  function confirmRename(): void {
    const trimmed = editValue().trim();
    if (trimmed && trimmed !== props.entry.fileName) {
      props.onRename?.(props.entry.id, trimmed);
    }
    setIsEditing(false);
  }

  function cancelEditing(): void {
    setIsEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  }

  const metaText = () =>
    `${formatDate(props.entry.createdAt)} \u00B7 ${formatDuration(props.entry.duration)} \u00B7 ${props.entry.modelId}`;

  const result = () => toTranscriptionResult(props.entry);

  const titleSuggestion = () => {
    const title = aiContent().find((c) => c.contentType === "title");
    if (title && title.text !== props.entry.fileName) {
      return title.text;
    }
    return undefined;
  };

  return (
    <div class="flex flex-1 flex-col gap-2 overflow-hidden">
      {/* Header: Close + FileName (edit icon on hover, inline input on click) */}
      <div class="flex h-7 items-center gap-2">
        <Show when={props.onClose}>
          {(onClose) => (
            <Button
              variant="ghost"
              size="icon"
              class="size-7 shrink-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={onClose()}
            >
              <FiX class="size-4" />
            </Button>
          )}
        </Show>
        <div class="min-w-0 flex-1">
          <Show
            when={!isEditing()}
            fallback={
              <input
                type="text"
                autofocus
                class="h-7 w-full rounded bg-muted/50 px-1 text-base font-semibold outline-none"
                value={editValue()}
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                onBlur={cancelEditing}
              />
            }
          >
            <button
              type="button"
              class="group/name flex h-7 w-full min-w-0 items-center gap-1.5 rounded px-1 text-left hover:bg-muted/30"
              onClick={startEditing}
            >
              <span class="truncate text-base font-semibold">
                {props.entry.fileName}
              </span>
              <FiEdit2 class="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
            </button>
          </Show>
        </div>
      </div>
      {/* ResultViewer with meta info displayed in toolbar left side */}
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ResultViewer
          result={result()}
          fileName={metaText()}
          historyId={props.entry.id}
          initialAiContent={aiContent()}
          suggestedTitle={titleSuggestion()}
          onApplyTitle={(title) => {
            props.onRename?.(props.entry.id, title);
          }}
        />
      </div>
    </div>
  );
};

export { HistoryDetail };
