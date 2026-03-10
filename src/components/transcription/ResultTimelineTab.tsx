import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import type { TranscriptionSegment } from "~/types";

interface ResultTimelineTabProps {
  segments: TranscriptionSegment[];
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const ResultTimelineTab: Component<ResultTimelineTabProps> = (props) => {
  const { t } = useI18n();

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
            <div class="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-background/60">
              <span class="shrink-0 font-mono text-xs text-muted-foreground">
                {formatTime(segment.start)}
              </span>
              <p class="text-sm">{segment.text.trim()}</p>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};

export { ResultTimelineTab };
