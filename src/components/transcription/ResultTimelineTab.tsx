import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import { formatDurationColon } from "~/lib/format";
import type { TranscriptionSegment } from "~/types";

interface ResultTimelineTabProps {
  segments: TranscriptionSegment[];
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
                {formatDurationColon(segment.start)}
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
