import type { Component } from "solid-js";
import { useI18n } from "~/i18n";
import { ResultProcessingShell } from "./ResultProcessingShell";

interface ResultCleanTextTabProps {
  cleanTextResult: string | null;
  isProcessing: boolean;
  onCancel: () => void;
}

const ResultCleanTextTab: Component<ResultCleanTextTabProps> = (props) => {
  const { t } = useI18n();

  return (
    <ResultProcessingShell
      isProcessing={props.isProcessing}
      processingLabel={t("textProcessing.cleaningText")}
      onCancel={props.onCancel}
      hasResult={props.cleanTextResult !== null}
    >
      <div class="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
        {props.cleanTextResult}
      </div>
    </ResultProcessingShell>
  );
};

export { ResultCleanTextTab };
