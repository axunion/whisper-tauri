import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { FiCheck, FiCopy, FiDownload } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { ProofreadPanel, SummaryPanel } from "~/components/text-processing";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { Separator } from "~/components/ui/Separator";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";
import { exportResult, getExtension } from "~/lib/export";
import { toast } from "~/lib/toast";
import { createSettings } from "~/primitives/createSettings";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type { SummaryOptions, TranscriptionResult } from "~/types";

interface ResultViewerProps {
  result: TranscriptionResult;
}

const FORMAT_OPTIONS = [
  { value: "txt", label: "TXT" },
  { value: "srt", label: "SRT" },
  { value: "vtt", label: "VTT" },
] as const;

type OptionItem = { value: string; label: string };

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);
  const settings = createSettings();
  const [format, setFormat] = createSignal<ExportFormat>(
    settings.outputFormat(),
  );
  const [showProofread, setShowProofread] = createSignal(false);
  const [showSummary, setShowSummary] = createSignal(false);
  const tp = createTextProcessing();

  async function handleCopy() {
    try {
      await writeText(props.result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("result.copiedToast"));
    } catch (e) {
      console.error("Failed to copy text:", e);
      toast.error(t("result.copyFailedToast"));
    }
  }

  async function handleSave() {
    try {
      const ext = getExtension(format());
      const filePath = await save({
        filters: [{ name: format().toUpperCase(), extensions: [format()] }],
        defaultPath: `transcription${ext}`,
      });
      if (!filePath) return;
      const content = exportResult(props.result, format());
      await writeTextFile(filePath, content);
      toast.success(t("result.savedToast"));
    } catch (e) {
      console.error("Failed to save file:", e);
      toast.error(t("result.saveFailedToast"));
    }
  }

  function findOption(value: string): OptionItem | null {
    return FORMAT_OPTIONS.find((o) => o.value === value) ?? null;
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Badge variant="secondary">{props.result.language}</Badge>
          <span class="text-xs text-muted-foreground">
            {formatDuration(props.result.duration)}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Show when={copied()} fallback={<FiCopy class="size-4" />}>
              <FiCheck class="size-4" />
            </Show>
            <Show when={copied()} fallback={t("common.copy")}>
              {t("common.copied")}
            </Show>
          </Button>
          <Select<OptionItem>
            multiple={false}
            value={findOption(format())}
            onChange={(val) => {
              if (val) {
                setFormat(val.value as ExportFormat);
              }
            }}
            options={[...FORMAT_OPTIONS]}
            optionValue="value"
            optionTextValue="label"
            itemComponent={(itemProps) => (
              <SelectItem item={itemProps.item}>
                {itemProps.item.rawValue.label}
              </SelectItem>
            )}
          >
            <SelectTrigger class="h-8 w-20">
              <SelectValue<OptionItem>>
                {(state) => state.selectedOption().label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <FiDownload class="size-4" />
            {t("common.save")}
          </Button>
        </div>
      </div>
      <div class="max-h-80 overflow-y-auto rounded-lg border bg-muted/50 p-4">
        <p class="whitespace-pre-wrap text-sm">{props.result.text}</p>
      </div>

      {/* Text Processing Actions */}
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowProofread(true);
            setShowSummary(false);
            tp.proofread(props.result.text).then((result) => {
              if (result) {
                toast.success(t("textProcessing.proofreadCompletedToast"));
              }
            });
          }}
          disabled={tp.isProcessing()}
        >
          {tp.isProcessing() && showProofread()
            ? t("textProcessing.proofreading")
            : t("textProcessing.proofread")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowSummary(true);
            setShowProofread(false);
          }}
          disabled={tp.isProcessing()}
        >
          {tp.isProcessing() && showSummary()
            ? t("textProcessing.summarizing")
            : t("textProcessing.summarize")}
        </Button>
      </div>

      {/* Proofread Panel */}
      <Show when={showProofread()}>
        <Separator />
        <ProofreadPanel
          result={tp.proofreadResult()}
          inferenceProgress={tp.inferenceProgress()}
          isProcessing={tp.isProcessing()}
          onCancel={() => tp.cancel()}
        />
      </Show>

      {/* Summary Panel */}
      <Show when={showSummary()}>
        <Separator />
        <SummaryPanel
          result={tp.summaryResult()}
          inferenceProgress={tp.inferenceProgress()}
          isProcessing={tp.isProcessing()}
          onCancel={() => tp.cancel()}
          onSummarize={(options: SummaryOptions) => {
            tp.summarize(props.result.text, options).then((result) => {
              if (result) {
                toast.success(t("textProcessing.summarizeCompletedToast"));
              }
            });
          }}
        />
      </Show>
    </div>
  );
};

export { ResultViewer };
