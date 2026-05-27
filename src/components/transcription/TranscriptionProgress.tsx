import { FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import type { TranscriptionProgress as TranscriptionProgressType } from "~/types";

const MEASURED_PROGRESS_THRESHOLD = 5;
const EMA_ALPHA = 0.3;
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
  let smoothedRemainingSec: number | undefined;

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
      smoothedRemainingSec = undefined;
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
    let rawRemainingSec: number | undefined;

    if (progressPct >= MEASURED_PROGRESS_THRESHOLD) {
      rawRemainingSec = (elapsedSec * (100 - progressPct)) / progressPct;
    } else if (estimatedTotalSec !== undefined && estimatedTotalSec > 0) {
      rawRemainingSec = Math.max(0, estimatedTotalSec - elapsedSec);
    }

    if (rawRemainingSec === undefined) return undefined;

    // EMA smoothing to stabilize display when VAD causes progress jumps
    if (smoothedRemainingSec === undefined) {
      smoothedRemainingSec = rawRemainingSec;
    } else {
      smoothedRemainingSec =
        EMA_ALPHA * rawRemainingSec + (1 - EMA_ALPHA) * smoothedRemainingSec;
    }

    const remainingMin = Math.ceil(smoothedRemainingSec / 60);
    if (remainingMin < 1) return t("transcription.almostDone");
    return t("transcription.remainingTime", { minutes: remainingMin });
  }

  // Keep the live region on a single persistent node with reactive content.
  // If it lived inside <Show> branches, the placeholder→real-label transition
  // would swap the DOM node and screen readers would miss the first announcement.
  const remainingLabel = () => {
    const p = props.progress;
    if (!p) return NBSP;
    return (
      getRemainingLabel(
        p.progress,
        localElapsedMs(),
        props.estimatedTotalSec,
      ) ?? NBSP
    );
  };
  const progressPct = () => props.progress?.progress ?? 0;

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground" aria-live="polite">
          {remainingLabel()}
        </span>
        <span class="font-medium" aria-hidden="true">
          {Math.round(progressPct())}%
        </span>
      </div>
      <Progress value={progressPct()} />
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
