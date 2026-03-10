import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { useI18n } from "~/i18n";
import type { InferenceProgress, SummaryLength, SummaryOptions } from "~/types";

interface ResultSummaryTabProps {
  result: string | null;
  inferenceProgress: InferenceProgress | null;
  isProcessing: boolean;
  onSummarize: (options: SummaryOptions) => void;
}

type OptionItem = { value: string; label: string };

const ResultSummaryTab: Component<ResultSummaryTabProps> = (props) => {
  const { t } = useI18n();
  const [length, setLength] = createSignal<SummaryLength>("medium");
  const [bulletPoints, setBulletPoints] = createSignal(false);

  const lengthOptions = (): OptionItem[] => [
    { value: "short", label: t("textProcessing.summaryLengthShort") },
    { value: "medium", label: t("textProcessing.summaryLengthMedium") },
    { value: "long", label: t("textProcessing.summaryLengthLong") },
  ];

  const displayText = () => {
    if (props.result) return props.result;
    if (props.inferenceProgress) return props.inferenceProgress.accumulatedText;
    return "";
  };

  function findOption(value: string): OptionItem | null {
    return lengthOptions().find((o) => o.value === value) ?? null;
  }

  function handleSummarize() {
    props.onSummarize({
      length: length(),
      bulletPoints: bulletPoints(),
    });
  }

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show
        when={props.isProcessing || displayText()}
        fallback={
          <div class="flex flex-1 flex-col items-center justify-center gap-4">
            <div class="flex items-center gap-3">
              <Select<OptionItem>
                multiple={false}
                value={findOption(length())}
                onChange={(val) => {
                  if (val) setLength(val.value as SummaryLength);
                }}
                options={lengthOptions()}
                optionValue="value"
                optionTextValue="label"
                itemComponent={(itemProps) => (
                  <SelectItem item={itemProps.item}>
                    {itemProps.item.rawValue.label}
                  </SelectItem>
                )}
              >
                <SelectTrigger class="h-8 w-28">
                  <SelectValue<OptionItem>>
                    {(state) => state.selectedOption().label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>

              <label class="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={bulletPoints()}
                  onChange={(e) => setBulletPoints(e.currentTarget.checked)}
                  class="rounded border-input"
                />
                {t("textProcessing.bulletPoints")}
              </label>
            </div>
            <Button size="sm" onClick={handleSummarize}>
              {t("textProcessing.summarize")}
            </Button>
          </div>
        }
      >
        <Show
          when={displayText()}
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("textProcessing.summarizing")}
            </p>
          }
        >
          <p class="whitespace-pre-wrap text-sm">{displayText()}</p>
        </Show>
      </Show>
    </div>
  );
};

export { ResultSummaryTab };
