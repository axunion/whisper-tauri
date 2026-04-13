import { FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import type { TranscriptionProgress as TranscriptionProgressType } from "~/types";

const MEASURED_PROGRESS_THRESHOLD = 5;
const NBSP = "\u00A0";

interface TranscriptionProgressProps {
  progress: TranscriptionProgressType | null;
  estimatedTotalSec?: number | undefined;
  onCancel: () => void;
}

const TranscriptionProgress: Component<TranscriptionProgressProps> = (
  props,
) => {
  const { t } = useI18n();

  const [localElapsedMs, setLocalElapsedMs] = createSignal(0);
  const [isCancelling, setIsCancelling] = createSignal(false);
  let startTime: number | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  function handleCancel() {
    if (isCancelling()) return;
    setIsCancelling(true);
    props.onCancel();
  }

  createEffect(() => {
    const p = props.progress;
    if (p && startTime === undefined) {
      const anchor = Date.now() - p.elapsedMs;
      startTime = anchor;
      setLocalElapsedMs(p.elapsedMs);
      timer = setInterval(() => {
        setLocalElapsedMs(Date.now() - anchor);
      }, 1000);
    }
  });

  onCleanup(() => {
    if (timer) clearInterval(timer);
  });

  function getRemainingLabel(
    progressPct: number,
    elapsedMs: number,
    estimatedTotalSec: number | undefined,
  ): string | undefined {
    const elapsedSec = elapsedMs / 1000;
    let remainingSec: number | undefined;

    if (progressPct >= MEASURED_PROGRESS_THRESHOLD) {
      remainingSec = (elapsedSec * (100 - progressPct)) / progressPct;
    } else if (estimatedTotalSec !== undefined && estimatedTotalSec > 0) {
      remainingSec = Math.max(0, estimatedTotalSec - elapsedSec);
    }

    if (remainingSec === undefined) return undefined;

    const remainingMin = Math.ceil(remainingSec / 60);
    if (remainingMin < 1) return t("transcription.almostDone");
    return t("transcription.remainingTime", { minutes: remainingMin });
  }

  return (
    <div class="space-y-3">
      <Show
        when={props.progress}
        fallback={
          <>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">{NBSP}</span>
              <span class="font-medium">0%</span>
            </div>
            <Progress value={0} />
          </>
        }
      >
        {(progress) => (
          <>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">
                {getRemainingLabel(
                  progress().progress,
                  localElapsedMs(),
                  props.estimatedTotalSec,
                ) ?? NBSP}
              </span>
              <span class="font-medium">
                {Math.round(progress().progress)}%
              </span>
            </div>
            <Progress value={progress().progress} />
            <Show when={progress().currentSegment}>
              {(segment) => (
                <p class="truncate text-xs text-muted-foreground">
                  {segment()}
                </p>
              )}
            </Show>
          </>
        )}
      </Show>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCancel}
        disabled={isCancelling()}
      >
        <FiX />
        {isCancelling() ? t("transcription.cancelling") : t("common.cancel")}
      </Button>
    </div>
  );
};

export { TranscriptionProgress };
