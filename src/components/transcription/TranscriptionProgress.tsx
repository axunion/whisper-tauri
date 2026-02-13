import type { Component } from "solid-js";
import { Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Progress } from "~/components/ui/Progress";
import type { TranscriptionProgress as TranscriptionProgressType } from "~/types";

interface TranscriptionProgressProps {
  progress: TranscriptionProgressType | null;
  onCancel: () => void;
}

function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const TranscriptionProgress: Component<TranscriptionProgressProps> = (
  props,
) => {
  return (
    <Show when={props.progress}>
      {(progress) => (
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">
              {formatElapsedTime(progress().elapsedMs)}
            </span>
            <span class="font-medium">{Math.round(progress().progress)}%</span>
          </div>
          <Progress value={progress().progress} />
          <Show when={progress().currentSegment}>
            {(segment) => (
              <p class="truncate text-xs text-muted-foreground">{segment()}</p>
            )}
          </Show>
          <Button variant="outline" size="sm" onClick={() => props.onCancel()}>
            Cancel
          </Button>
        </div>
      )}
    </Show>
  );
};

export { TranscriptionProgress };
