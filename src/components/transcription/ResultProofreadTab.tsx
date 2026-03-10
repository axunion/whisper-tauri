import type { Component } from "solid-js";
import { Show } from "solid-js";
import { useI18n } from "~/i18n";
import type { InferenceProgress } from "~/types";

interface ResultProofreadTabProps {
  result: string | null;
  inferenceProgress: InferenceProgress | null;
  isProcessing: boolean;
}

const ResultProofreadTab: Component<ResultProofreadTabProps> = (props) => {
  const { t } = useI18n();

  const displayText = () => {
    if (props.result) return props.result;
    if (props.inferenceProgress) return props.inferenceProgress.accumulatedText;
    return "";
  };

  return (
    <div class="h-full overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show
        when={displayText()}
        fallback={
          <p class="text-sm text-muted-foreground">
            {t("textProcessing.proofreading")}
          </p>
        }
      >
        <p class="whitespace-pre-wrap text-sm">{displayText()}</p>
      </Show>
    </div>
  );
};

export { ResultProofreadTab };
