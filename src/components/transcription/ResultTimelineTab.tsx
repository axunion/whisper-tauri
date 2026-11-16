import { FiEdit2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import { formatDurationColon } from "~/lib/format";
import { cn } from "~/lib/utils";
import { createTitleEditor } from "~/primitives/createTitleEditor";
import type { TranscriptionSegment } from "~/types";

interface ResultTimelineTabProps {
  segments: TranscriptionSegment[];
  /** Playback position in ms; the segment containing it is highlighted. */
  positionMs?: number | undefined;
  /** When set, a segment can be clicked to play the audio from its start. */
  onSeek?: ((ms: number) => void) | undefined;
  /** When set, a segment's text can be corrected in place. */
  onEdit?: ((index: number, text: string) => void) | undefined;
}

const textClass = "min-w-0 flex-1 text-left text-sm";

const ResultTimelineTab: Component<ResultTimelineTabProps> = (props) => {
  const { t } = useI18n();
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);

  const editor = createTitleEditor({
    onConfirm: (value) => {
      const index = editingIndex();
      if (index === null) return;
      if (value !== props.segments[index]?.text.trim()) {
        props.onEdit?.(index, value);
      }
    },
  });

  function startEditing(index: number, text: string): void {
    setEditingIndex(index);
    editor.startEditing(text.trim());
  }

  const isEditing = (index: number) =>
    editor.isEditing() && editingIndex() === index;

  const isActive = (segment: TranscriptionSegment) =>
    props.positionMs !== undefined &&
    props.positionMs >= segment.start &&
    props.positionMs < segment.end;

  return (
    <div class="h-full overflow-y-auto rounded-lg border bg-muted/50 p-2">
      <Show
        when={props.segments.length > 0}
        fallback={
          <p class="p-2 text-sm text-muted-foreground">
            {t("result.timelineTab")}
          </p>
        }
      >
        <For each={props.segments}>
          {(segment, index) => (
            <div
              class={cn(
                "group/row flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-background/60",
                isActive(segment) && "bg-primary/10",
              )}
            >
              <span class="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                {formatDurationColon(segment.start)}
              </span>
              <Show
                when={!isEditing(index())}
                fallback={
                  <input
                    type="text"
                    autofocus
                    class="min-w-0 flex-1 border-b border-muted-foreground/40 bg-transparent text-sm outline-none"
                    aria-label={t("result.editSegment")}
                    value={editor.editValue()}
                    onInput={(e) => editor.setEditValue(e.currentTarget.value)}
                    onKeyDown={editor.handleKeyDown}
                    // Guarded: removing the focused input (on Enter or Escape)
                    // can itself fire blur, which must not confirm again —
                    // or save what Escape just discarded.
                    onBlur={() => {
                      if (editor.isEditing()) editor.confirm();
                    }}
                  />
                }
              >
                <Show
                  when={props.onSeek}
                  fallback={
                    <span class={textClass}>{segment.text.trim()}</span>
                  }
                >
                  {(onSeek) => (
                    <button
                      type="button"
                      class={cn(textClass, "cursor-pointer")}
                      aria-current={isActive(segment) ? "true" : undefined}
                      onClick={() => onSeek()(segment.start)}
                    >
                      {segment.text.trim()}
                    </button>
                  )}
                </Show>
                <Show when={props.onEdit}>
                  <button
                    type="button"
                    class="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
                    aria-label={t("result.editSegment")}
                    onClick={() => startEditing(index(), segment.text)}
                  >
                    <FiEdit2 class="size-3.5" aria-hidden="true" />
                  </button>
                </Show>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export { ResultTimelineTab };
