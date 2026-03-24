import * as CheckboxPrimitive from "@kobalte/core/checkbox";
import * as SelectPrimitive from "@kobalte/core/select";
import { FiX } from "solid-icons/fi";
import { TbSparkles } from "solid-icons/tb";
import type { Component } from "solid-js";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Checkbox } from "~/components/ui/Checkbox";
import { SelectContent, SelectItem } from "~/components/ui/Select";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import type { InferenceProgress, SummaryLength, SummaryOptions } from "~/types";

interface ResultSummaryTabProps {
  summaryResult: string | null;
  actionItemsResult: string | null;
  inferenceProgress: InferenceProgress | null;
  isProcessing: boolean;
  currentOperation: "summary" | "actionItems" | null;
  onSummarize: (options: SummaryOptions) => void;
  onCancel: () => void;
}

const LENGTH_OPTIONS: SummaryLength[] = ["short", "medium", "long"];

const LENGTH_KEYS: Record<SummaryLength, DictionaryKey> = {
  short: "textProcessing.summaryLengthShort",
  medium: "textProcessing.summaryLengthMedium",
  long: "textProcessing.summaryLengthLong",
};

const ResultSummaryTab: Component<ResultSummaryTabProps> = (props) => {
  const { t } = useI18n();
  const [length, setLength] = createSignal<SummaryLength>("medium");
  const [bulletPoints, setBulletPoints] = createSignal(false);

  const hasResult = () => props.summaryResult !== null;
  const isEmpty = () => !hasResult() && !props.isProcessing;

  const actionItems = createMemo(() => {
    const result = props.actionItemsResult;
    if (!result) return [];
    if (
      result.includes(
        "\u30A2\u30AF\u30B7\u30E7\u30F3\u30A2\u30A4\u30C6\u30E0\u306F\u3042\u308A\u307E\u305B\u3093",
      )
    )
      return [];
    return result
      .split("\n")
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter((line) => line.length > 0);
  });

  const showActionItems = () => actionItems().length > 0;

  function handleSummarize() {
    props.onSummarize({ length: length(), bulletPoints: bulletPoints() });
  }

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show when={isEmpty()}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <div class="flex items-center gap-3">
            <SelectPrimitive.Root
              value={length()}
              onChange={(value) => {
                if (value) setLength(value);
              }}
              options={LENGTH_OPTIONS}
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>
                  {t(LENGTH_KEYS[itemProps.item.rawValue])}
                </SelectItem>
              )}
            >
              <SelectPrimitive.Trigger class="flex h-8 w-24 items-center justify-between rounded-md border border-input bg-transparent px-2 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <SelectPrimitive.Value<SummaryLength>>
                  {(state) => t(LENGTH_KEYS[state.selectedOption()])}
                </SelectPrimitive.Value>
                <SelectPrimitive.Icon
                  as="svg"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-4 opacity-50"
                >
                  <path d="M8 9l4 -4l4 4" />
                  <path d="M16 15l-4 4l-4 -4" />
                </SelectPrimitive.Icon>
              </SelectPrimitive.Trigger>
              <SelectContent />
            </SelectPrimitive.Root>
            <Checkbox checked={bulletPoints()} onChange={setBulletPoints}>
              <CheckboxPrimitive.Label class="text-sm">
                {t("textProcessing.bulletPoints")}
              </CheckboxPrimitive.Label>
            </Checkbox>
          </div>
          <Button size="sm" onClick={handleSummarize}>
            <TbSparkles />
            {t("textProcessing.generateSummary")}
          </Button>
        </div>
      </Show>

      <Show when={props.isProcessing}>
        <div class="flex flex-1 flex-col">
          <Show when={props.currentOperation === "summary"}>
            <p class="whitespace-pre-wrap text-sm">
              {props.inferenceProgress?.accumulatedText ||
                t("textProcessing.summarizing")}
            </p>
          </Show>
          <Show when={props.currentOperation === "actionItems"}>
            <p class="whitespace-pre-wrap text-sm">{props.summaryResult}</p>
            <p class="mt-4 animate-pulse text-sm text-muted-foreground">
              {t("textProcessing.extractingActionItems")}
            </p>
          </Show>
          <div class="mt-4 flex justify-center">
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
        </div>
      </Show>

      <Show when={hasResult() && !props.isProcessing}>
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1 px-2 text-xs"
              disabled={props.isProcessing}
              onClick={() =>
                props.onSummarize({
                  length: length(),
                  bulletPoints: bulletPoints(),
                })
              }
            >
              <TbSparkles class="size-3" />
              {t("textProcessing.regenerate")}
            </Button>
          </div>
          <p class="whitespace-pre-wrap text-sm">{props.summaryResult}</p>

          <Show when={showActionItems()}>
            <div class="mt-4 border-t pt-3">
              <p class="mb-2 text-xs font-medium text-muted-foreground">
                {t("textProcessing.actionItemsLabel")}
              </p>
              <ul class="space-y-1.5 text-sm">
                <For each={actionItems()}>
                  {(item) => (
                    <li class="flex gap-2">
                      <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export { ResultSummaryTab };
