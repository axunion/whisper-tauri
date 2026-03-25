import { FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface ResultKeywordsTabProps {
  keywordsResult: string | null;
  isProcessing: boolean;
  onCancel: () => void;
}

const ResultKeywordsTab: Component<ResultKeywordsTabProps> = (props) => {
  const { t } = useI18n();

  const hasResult = () => props.keywordsResult !== null;

  const keywords = () => {
    const result = props.keywordsResult;
    if (!result) return [];
    return result
      .split(/[,\u3001]/)
      .map((kw) => kw.trim())
      .filter((kw) => kw.length > 0);
  };

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show when={props.isProcessing}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <p class="animate-pulse text-sm text-muted-foreground">
            {t("textProcessing.extractKeywords")}...
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
        <div class="flex flex-wrap gap-1.5">
          <For each={keywords()}>
            {(keyword) => (
              <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {keyword}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export { ResultKeywordsTab };
