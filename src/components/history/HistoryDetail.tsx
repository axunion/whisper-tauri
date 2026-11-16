import { convertFileSrc } from "@tauri-apps/api/core";
import {
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit2,
  FiMusic,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "solid-icons/fi";
import type { Component } from "solid-js";
import { createMemo, createSignal, Show } from "solid-js";
import { VadBadge } from "~/components/history/VadBadge";
import { ResultViewer } from "~/components/transcription/ResultViewer";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useI18n } from "~/i18n";
import { formatDate, formatDuration } from "~/lib/format";
import type { AiOperation } from "~/primitives/createAiSession";
import { createTitleEditor } from "~/primitives/createTitleEditor";
import type { HistoryEntry, TranscriptionResult } from "~/types";

interface HistoryDetailProps {
  entry: HistoryEntry;
  onRename?: (id: string, newFileName: string) => void;
  onDeleteAudio: (id: string) => void | Promise<void>;
  onRetranscribe: (entry: HistoryEntry) => void;
  /** False while leaving for a re-transcription would interrupt running work. */
  canRetranscribe: boolean;
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
  const { locale, t } = useI18n();
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

  const audioActions = () => (
    <div class="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label={t("history.retranscribe")}
        title={t("history.retranscribe")}
        disabled={!props.canRetranscribe}
        onClick={() => props.onRetranscribe(props.entry)}
      >
        <FiRefreshCw class="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        title={t("history.deleteAudio")}
        description={t("history.deleteAudioConfirmation")}
        confirmLabel={
          <>
            <FiTrash2 />
            {t("common.delete")}
          </>
        }
        onConfirm={() => props.onDeleteAudio(props.entry.id)}
      >
        {(openDialog) => (
          <Button
            variant="ghost"
            size="icon"
            class="size-8 hover:text-destructive"
            aria-label={t("history.deleteAudio")}
            title={t("history.deleteAudio")}
            onClick={openDialog}
          >
            <FiTrash2 class="size-4" aria-hidden="true" />
          </Button>
        )}
      </ConfirmDialog>
    </div>
  );

  // Derived through a path-only memo: a rename replaces the entry object, and
  // handing the player a new `src` — even an equal one — restarts playback.
  const audioPath = createMemo(() => props.entry.audioPath);
  const audio = createMemo(() => {
    const path = audioPath();
    return path
      ? { src: convertFileSrc(path), actions: audioActions() }
      : undefined;
  });

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
                aria-label={t("common.editTitle")}
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
                "opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100":
                  !title.isEditing(),
              }}
              aria-label={
                title.isEditing() ? t("common.confirm") : t("common.editTitle")
              }
              // Keep focus on the input: mousedown would otherwise blur it and
              // run cancelEditing() before this click lands, so confirming an
              // edit by clicking would silently discard it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                title.isEditing() ? title.confirm() : startEditing()
              }
            >
              <Show
                when={title.isEditing()}
                fallback={<FiEdit2 class="size-3.5" aria-hidden="true" />}
              >
                <FiCheck class="size-3.5" aria-hidden="true" />
              </Show>
            </button>
          }
        >
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("common.confirm")}
            onClick={title.confirm}
          >
            <FiCheck class="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("common.cancel")}
            onClick={cancelEditing}
          >
            <FiX class="size-3.5" aria-hidden="true" />
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
          audio={audio()}
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
