import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { FiCheck, FiCopy, FiX } from "solid-icons/fi";
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
import { toast } from "~/lib/toast";
import type { InferenceProgress, SummaryLength, SummaryOptions } from "~/types";

interface SummaryPanelProps {
  result: string | null;
  inferenceProgress: InferenceProgress | null;
  isProcessing: boolean;
  onCancel: () => void;
  onSummarize: (options: SummaryOptions) => void;
}

type OptionItem = { value: string; label: string };

const SummaryPanel: Component<SummaryPanelProps> = (props) => {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);
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

  async function handleCopy() {
    const text = displayText();
    if (!text) return;
    try {
      await writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("result.copiedToast"));
    } catch {
      toast.error(t("result.copyFailedToast"));
    }
  }

  function handleSummarize() {
    props.onSummarize({
      length: length(),
      bulletPoints: bulletPoints(),
    });
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">
          {t("textProcessing.summaryResult")}
        </span>
        <div class="flex items-center gap-2">
          <Show when={props.isProcessing}>
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              <FiX class="size-4" />
              {t("common.cancel")}
            </Button>
          </Show>
          <Show when={!props.isProcessing && displayText()}>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Show when={copied()} fallback={<FiCopy class="size-4" />}>
                <FiCheck class="size-4" />
              </Show>
              {t("textProcessing.copyResult")}
            </Button>
          </Show>
        </div>
      </div>

      {/* Options row */}
      <Show when={!props.isProcessing && !displayText()}>
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

          <Button size="sm" onClick={handleSummarize}>
            {t("textProcessing.summarize")}
          </Button>
        </div>
      </Show>

      <Show when={props.isProcessing || displayText()}>
        <div class="max-h-60 overflow-y-auto rounded-lg border bg-muted/50 p-4">
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
        </div>
      </Show>
    </div>
  );
};

export { SummaryPanel };
