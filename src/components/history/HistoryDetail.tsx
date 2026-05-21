import {
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit2,
  FiMusic,
  FiX,
} from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { VadBadge } from "~/components/history/VadBadge";
import { ResultViewer } from "~/components/transcription/ResultViewer";
import { useI18n } from "~/i18n";
import { formatDate, formatDuration } from "~/lib/format";
import type { AiOperation } from "~/primitives/createAiSession";
import { createTitleEditor } from "~/primitives/createTitleEditor";
import type { HistoryEntry, TranscriptionResult } from "~/types";

interface HistoryDetailProps {
  entry: HistoryEntry;
  onRename?: (id: string, newFileName: string) => void;
  onProcessingChange?: (
    operation: AiOperation,
    cancel: () => Promise<void>,
  ) => void;
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
  const [isSuggestion, setIsSuggestion] = createSignal(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = createSignal(false);

  const title = createTitleEditor({
    onConfirm: (value) => {
      if (value !== props.entry.fileName) {
        props.onRename?.(props.entry.id, value);
      }
      setIsSuggestion(false);
    },
  });

  function startEditing(): void {
    setIsSuggestion(false);
    title.startEditing(props.entry.fileName);
  }

  function startSuggestion(suggested: string): void {
    setIsSuggestion(true);
    title.startEditing(suggested);
  }

  function cancelEditing(): void {
    setIsSuggestion(false);
    title.cancel();
  }

  const result = () => toTranscriptionResult(props.entry);

  const metadataJSX = () => (
    <span class="inline-flex items-center gap-3 text-xs text-muted-foreground">
      <span class="inline-flex items-center gap-1">
        <FiCalendar class="size-3" />
        {formatDate(props.entry.createdAt, locale())}
      </span>
      <span class="inline-flex items-center gap-1">
        <FiClock class="size-3" />
        {formatDuration(props.entry.duration)}
      </span>
      <span class="inline-flex items-center gap-1">
        <FiMusic class="size-3" />
        {props.entry.modelId}
      </span>
      <VadBadge vadEnabled={props.entry.vadEnabled} />
    </span>
  );

  return (
    <div class="flex flex-1 flex-col gap-2 overflow-hidden">
      {/* Title: fixed-height row, flex-1 container keeps icon position stable */}
      <div class="group/title flex h-8 items-center gap-1.5">
        <div class="min-w-0 flex-1">
          <Show
            when={!title.isEditing()}
            fallback={
              <input
                type="text"
                autofocus
                class="w-full border-b border-muted-foreground/40 bg-transparent text-lg font-semibold outline-none"
                value={title.editValue()}
                onInput={(e) => title.setEditValue(e.currentTarget.value)}
                onKeyDown={title.handleKeyDown}
                onBlur={() => {
                  if (!isSuggestion()) cancelEditing();
                }}
              />
            }
          >
            <span
              class="block truncate text-lg font-semibold"
              classList={{ "animate-pulse": isGeneratingTitle() }}
            >
              {props.entry.fileName}
            </span>
          </Show>
        </div>
        <Show
          when={isSuggestion() && title.isEditing()}
          fallback={
            <button
              type="button"
              class="shrink-0 text-muted-foreground transition-opacity"
              classList={{
                "opacity-0 group-hover/title:opacity-100": !title.isEditing(),
              }}
              onClick={() =>
                title.isEditing() ? title.confirm() : startEditing()
              }
            >
              <Show
                when={title.isEditing()}
                fallback={<FiEdit2 class="size-3.5" />}
              >
                <FiCheck class="size-3.5" />
              </Show>
            </button>
          }
        >
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={title.confirm}
          >
            <FiCheck class="size-3.5" />
          </button>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={cancelEditing}
          >
            <FiX class="size-3.5" />
          </button>
        </Show>
      </div>
      {/* ResultViewer with metadata integrated into toolbar */}
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ResultViewer
          result={result()}
          fileName={metadataJSX()}
          fileNameText={props.entry.fileName}
          historyId={props.entry.id}
          onTitleGenerated={(title) => startSuggestion(title)}
          onGeneratingTitleChange={setIsGeneratingTitle}
          onProcessingChange={props.onProcessingChange}
          notionMeta={{
            createdAt: props.entry.createdAt,
            modelId: props.entry.modelId,
            duration: props.entry.duration,
            vadEnabled: props.entry.vadEnabled,
          }}
        />
      </div>
    </div>
  );
};

export { HistoryDetail };
