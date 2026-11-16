import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import { formatDurationColon } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { TranscriptionSegment } from "~/types";

interface ResultTimelineTabProps {
  segments: TranscriptionSegment[];
  /** Playback position in ms; the segment containing it is highlighted. */
  positionMs?: number | undefined;
  /** When set, a segment can be clicked to play the audio from its start. */
  onSeek?: ((ms: number) => void) | undefined;
}

const rowClass =
  "flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left";

const ResultTimelineTab: Component<ResultTimelineTabProps> = (props) => {
  const { t } = useI18n();

  const isActive = (segment: TranscriptionSegment) =>
    props.positionMs !== undefined &&
    props.positionMs >= segment.start &&
    props.positionMs < segment.end;

  const content = (segment: TranscriptionSegment) => (
    <>
      <span class="shrink-0 font-mono text-xs text-muted-foreground">
        {formatDurationColon(segment.start)}
      </span>
      <span class="text-sm">{segment.text.trim()}</span>
    </>
  );

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
          {(segment) => (
            <Show
              when={props.onSeek}
              fallback={
                <div class={cn(rowClass, "hover:bg-background/60")}>
                  {content(segment)}
                </div>
              }
            >
              {(onSeek) => (
                <button
                  type="button"
                  class={cn(
                    rowClass,
                    "cursor-pointer hover:bg-background/60",
                    isActive(segment) && "bg-primary/10",
                  )}
                  aria-current={isActive(segment) ? "true" : undefined}
                  onClick={() => onSeek()(segment.start)}
                >
                  {content(segment)}
                </button>
              )}
            </Show>
          )}
        </For>
      </Show>
    </div>
  );
};

export { ResultTimelineTab };
