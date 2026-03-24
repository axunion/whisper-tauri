import { useNavigate } from "@solidjs/router";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { FiSettings, FiX } from "solid-icons/fi";
import { TbSparkles } from "solid-icons/tb";
import type { Component } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";
import { exportResult, getExtension } from "~/lib/export";
import { toast } from "~/lib/toast";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type { AiContent, SummaryOptions, TranscriptionResult } from "~/types";
import { ResultKeywordsTab } from "./ResultKeywordsTab";
import { ResultSummaryTab } from "./ResultSummaryTab";
import { ResultTextTab } from "./ResultTextTab";
import { ResultTimelineTab } from "./ResultTimelineTab";
import type { ResultTab } from "./ResultToolbar";
import { ResultToolbar } from "./ResultToolbar";

interface ResultViewerProps {
  result: TranscriptionResult;
  fileName: string;
  historyId?: string | undefined;
  initialAiContent?: AiContent[] | undefined;
  onClose?: (() => void) | undefined;
  suggestedTitle?: string | undefined;
  onApplyTitle?: ((title: string) => void) | undefined;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<ResultTab>("text");
  const [showPrereqDialog, setShowPrereqDialog] = createSignal(false);
  const [titleDismissed, setTitleDismissed] = createSignal(false);
  const tp = createTextProcessing();

  const hasDownloadedModel = () => tp.models().some((m) => m.downloaded);
  const isReady = () => tp.serverAvailable() && hasDownloadedModel();

  const summaryTabVisible = () =>
    tp.summaryResult() !== null ||
    tp.actionItemsResult() !== null ||
    tp.isProcessing() ||
    (props.initialAiContent?.some(
      (c) => c.contentType === "summary" || c.contentType === "actionItems",
    ) ??
      false);

  const keywordsTabVisible = () =>
    tp.keywordsResult() !== null ||
    (props.initialAiContent?.some((c) => c.contentType === "keywords") ??
      false);

  onMount(() => {
    tp.checkServer();
    tp.loadModels();

    const initial = props.initialAiContent;
    if (initial) {
      const summary = initial.find((c) => c.contentType === "summary");
      if (summary) tp.setSummaryResult(summary.text);
      const keywords = initial.find((c) => c.contentType === "keywords");
      if (keywords) tp.setKeywordsResult(keywords.text);
      const actionItems = initial.find((c) => c.contentType === "actionItems");
      if (actionItems) tp.setActionItemsResult(actionItems.text);
    }
  });

  function getCopyText(): string {
    const tab = activeTab();
    if (tab === "summary") {
      return (
        tp.summaryResult() ?? tp.inferenceProgress()?.accumulatedText ?? ""
      );
    }
    if (tab === "keywords") {
      return tp.keywordsResult() ?? "";
    }
    return props.result.text;
  }

  async function handleCopy() {
    const text = getCopyText();
    if (!text) return;
    try {
      await writeText(text);
      toast.success(t("result.copiedToast"));
    } catch {
      toast.error(t("result.copyFailedToast"));
    }
  }

  async function handleSave(fmt: ExportFormat) {
    try {
      const ext = getExtension(fmt);
      const filePath = await save({
        filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }],
        defaultPath: `transcription${ext}`,
      });
      if (!filePath) return;
      const content = exportResult(props.result, fmt);
      await writeTextFile(filePath, content);
      toast.success(t("result.savedToast"));
    } catch {
      toast.error(t("result.saveFailedToast"));
    }
  }

  function handleSummarize() {
    if (!isReady()) {
      setShowPrereqDialog(true);
      return;
    }
    setActiveTab("summary");
  }

  function handleExtractKeywords() {
    if (!isReady()) {
      setShowPrereqDialog(true);
      return;
    }
    setActiveTab("keywords");
  }

  function handleSummarizeExecute(options: SummaryOptions) {
    tp.summarize(props.result.text, options, undefined, props.historyId).then(
      (result) => {
        if (result) {
          toast.success(t("textProcessing.summarizeCompletedToast"));
        }
      },
    );
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3">
      <ResultToolbar
        fileName={props.fileName}
        activeTab={activeTab()}
        onClose={props.onClose}
        onCopy={handleCopy}
        onSave={handleSave}
        onSummarize={handleSummarize}
        onExtractKeywords={handleExtractKeywords}
        isProcessing={tp.isProcessing()}
      />
      <Show when={props.suggestedTitle && !titleDismissed()}>
        <div class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <TbSparkles class="size-4 shrink-0 text-primary" />
          <span class="flex-1 truncate">
            {t("textProcessing.titleSuggestion")}:
            <span class="ml-1 font-medium">{props.suggestedTitle}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 shrink-0 px-2 text-xs"
            onClick={() => {
              if (props.suggestedTitle)
                props.onApplyTitle?.(props.suggestedTitle);
              setTitleDismissed(true);
            }}
          >
            {t("textProcessing.applyTitle")}
          </Button>
          <button
            type="button"
            class="inline-flex items-center rounded-full p-0.5 hover:bg-muted-foreground/20"
            onClick={() => setTitleDismissed(true)}
          >
            <FiX class="size-3" />
          </button>
        </div>
      </Show>
      <Tabs
        value={activeTab()}
        onChange={(value) => setActiveTab(value as ResultTab)}
        class="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="text">{t("result.textTab")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("result.timelineTab")}</TabsTrigger>
          <Show when={summaryTabVisible()}>
            <TabsTrigger value="summary">{t("result.summaryTab")}</TabsTrigger>
          </Show>
          <Show when={keywordsTabVisible()}>
            <TabsTrigger value="keywords">
              {t("result.keywordsTab")}
            </TabsTrigger>
          </Show>
        </TabsList>
        <TabsContent value="text" class="mt-3 min-h-0 flex-1">
          <ResultTextTab text={props.result.text} />
        </TabsContent>
        <TabsContent value="timeline" class="mt-3 min-h-0 flex-1">
          <ResultTimelineTab segments={props.result.segments} />
        </TabsContent>
        <Show when={summaryTabVisible()}>
          <TabsContent value="summary" class="mt-3 min-h-0 flex-1">
            <ResultSummaryTab
              summaryResult={tp.summaryResult()}
              actionItemsResult={tp.actionItemsResult()}
              inferenceProgress={tp.inferenceProgress()}
              isProcessing={tp.isProcessing()}
              currentOperation={((): "summary" | "actionItems" | null => {
                const op = tp.currentOperation();
                return op === "keywords" ? null : op;
              })()}
              onSummarize={handleSummarizeExecute}
              onCancel={() => tp.cancel()}
            />
          </TabsContent>
        </Show>
        <Show when={keywordsTabVisible()}>
          <TabsContent value="keywords" class="mt-3 min-h-0 flex-1">
            <ResultKeywordsTab
              keywordsResult={tp.keywordsResult()}
              isProcessing={tp.isProcessing()}
              onExtractKeywords={() => {
                tp.extractKeywords(
                  props.result.text,
                  undefined,
                  props.historyId,
                );
              }}
              onCancel={() => tp.cancel()}
            />
          </TabsContent>
        </Show>
      </Tabs>

      {/* Prerequisite dialog for text processing */}
      <AlertDialog open={showPrereqDialog()} onOpenChange={setShowPrereqDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("textProcessing.aiSetupRequired")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("textProcessing.aiSetupDescription")}
          </AlertDialogDescription>
          <div class="flex justify-end gap-2">
            <Button
              variant="outline"
              class="w-32"
              onClick={() => setShowPrereqDialog(false)}
            >
              <FiX class="size-4" />
              {t("common.close")}
            </Button>
            <Button
              class="w-32"
              onClick={() => {
                setShowPrereqDialog(false);
                navigate("/settings");
              }}
            >
              <FiSettings class="size-4" />
              {t("nav.settings")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export { ResultViewer };
