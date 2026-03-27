import { FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface ResultCleanTextTabProps {
  cleanTextResult: string | null;
  isProcessing: boolean;
  onCancel: () => void;
}

const ResultCleanTextTab: Component<ResultCleanTextTabProps> = (props) => {
  const { t } = useI18n();

  const hasResult = () => props.cleanTextResult !== null;

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show when={props.isProcessing}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <p class="animate-pulse text-sm text-muted-foreground">
            {t("textProcessing.cleaningText")}
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

      <Show when={hasResult() && !props.isProcessing}>
        <div class="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
          {props.cleanTextResult}
        </div>
      </Show>
    </div>
  );
};

export { ResultCleanTextTab };
