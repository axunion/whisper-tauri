import { FiX } from "solid-icons/fi";
import { TbSparkles } from "solid-icons/tb";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface ResultKeywordsTabProps {
  keywordsResult: string | null;
  isProcessing: boolean;
  onExtractKeywords: () => void;
  onCancel: () => void;
}

const ResultKeywordsTab: Component<ResultKeywordsTabProps> = (props) => {
  const { t } = useI18n();

  const hasResult = () => props.keywordsResult !== null;
  const isEmpty = () => !hasResult() && !props.isProcessing;

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
      <Show when={isEmpty()}>
        <div class="flex flex-1 items-center justify-center">
          <Button size="sm" onClick={props.onExtractKeywords}>
            <TbSparkles />
            {t("textProcessing.generateKeywords")}
          </Button>
        </div>
      </Show>

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
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1 px-2 text-xs"
              disabled={props.isProcessing}
              onClick={props.onExtractKeywords}
            >
              <TbSparkles class="size-3" />
              {t("textProcessing.regenerate")}
            </Button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <For each={keywords()}>
              {(keyword) => (
                <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {keyword}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export { ResultKeywordsTab };
