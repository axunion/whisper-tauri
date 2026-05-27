import { FiX } from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
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

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show when={props.isProcessing}>
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          class="flex flex-1 flex-col items-center justify-center gap-4"
        >
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
