import { FiX } from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
import { createMemo, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface ResultProcessingShellProps {
  isProcessing: boolean;
  processingLabel: string;
  onCancel: () => void;
  hasResult: boolean;
  children: JSX.Element;
}

/**
 * Shared layout for AI-processed result tabs: shows a cancel-able loading
 * state while processing, otherwise renders children when a result exists.
 */
const ResultProcessingShell: Component<ResultProcessingShellProps> = (
  props,
) => {
  const { t } = useI18n();

  // Keep the live region on a single persistent node with reactive content
  // (same technique as TranscriptionProgress). Announce completion only after
  // an actual processing run, not when a stored result renders on mount.
  const statusText = createMemo<string>((prev) => {
    if (props.isProcessing) return props.processingLabel;
    return prev ? (props.hasResult ? t("common.done") : "") : "";
  }, "");

  return (
    <div
      class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4"
      aria-busy={props.isProcessing}
    >
      <span role="status" aria-live="polite" class="sr-only">
        {statusText()}
      </span>
      <Show when={props.isProcessing}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <p class="animate-pulse text-sm text-muted-foreground">
            {props.processingLabel}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5"
            onClick={props.onCancel}
          >
            <FiX class="size-3.5" />
            {t("common.cancel")}
          </Button>
        </div>
      </Show>

      <Show when={props.hasResult && !props.isProcessing}>
        {props.children}
      </Show>
    </div>
  );
};

export { ResultProcessingShell };
