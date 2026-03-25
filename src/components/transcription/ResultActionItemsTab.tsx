import { FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createMemo, For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface ResultActionItemsTabProps {
  actionItemsResult: string | null;
  isProcessing: boolean;
  onCancel: () => void;
}

const ResultActionItemsTab: Component<ResultActionItemsTabProps> = (props) => {
  const { t } = useI18n();

  const hasResult = () => props.actionItemsResult !== null;

  const actionItems = createMemo(() => {
    const result = props.actionItemsResult;
    if (!result) return [];
    // LLM returns this phrase when no action items are found
    if (result.includes("アクションアイテムはありません")) return [];
    return result
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter((line) => line.length > 0);
  });

  const noItems = () => hasResult() && actionItems().length === 0;

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show when={props.isProcessing}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <p class="animate-pulse text-sm text-muted-foreground">
            {t("textProcessing.extractingActionItems")}
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
        <Show
          when={!noItems()}
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("textProcessing.noActionItems")}
            </p>
          }
        >
          <ul class="space-y-2 pl-4">
            <For each={actionItems()}>
              {(item) => (
                <li class="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
                  <span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span>{item}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </div>
  );
};

export { ResultActionItemsTab };
