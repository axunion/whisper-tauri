import { useNavigate } from "@solidjs/router";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { FiSettings, FiX } from "solid-icons/fi";
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
import type { SummaryOptions, TranscriptionResult } from "~/types";
import { ResultProofreadTab } from "./ResultProofreadTab";
import { ResultSummaryTab } from "./ResultSummaryTab";
import { ResultTextTab } from "./ResultTextTab";
import { ResultTimelineTab } from "./ResultTimelineTab";
import type { ResultTab } from "./ResultToolbar";
import { ResultToolbar } from "./ResultToolbar";

interface ResultViewerProps {
  result: TranscriptionResult;
  fileName: string;
  onClose?: (() => void) | undefined;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<ResultTab>("text");
  const [proofreadActivated, setProofreadActivated] = createSignal(false);
  const [summaryActivated, setSummaryActivated] = createSignal(false);
  const [showPrereqDialog, setShowPrereqDialog] = createSignal(false);
  const tp = createTextProcessing();

  const hasDownloadedModel = () => tp.models().some((m) => m.downloaded);
  const isReady = () => tp.serverAvailable() && hasDownloadedModel();

  onMount(() => {
    tp.checkServer();
    tp.loadModels();
  });

  function getCopyText(): string {
    const tab = activeTab();
    if (tab === "proofread") {
      return (
        tp.proofreadResult() ?? tp.inferenceProgress()?.accumulatedText ?? ""
      );
    }
    if (tab === "summary") {
      return (
        tp.summaryResult() ?? tp.inferenceProgress()?.accumulatedText ?? ""
      );
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

  function handleProofread() {
    if (!isReady()) {
      setShowPrereqDialog(true);
      return;
    }
    setProofreadActivated(true);
    setActiveTab("proofread");
    tp.proofread(props.result.text).then((result) => {
      if (result) {
        toast.success(t("textProcessing.proofreadCompletedToast"));
      }
    });
  }

  function handleSummarize() {
    if (!isReady()) {
      setShowPrereqDialog(true);
      return;
    }
    setSummaryActivated(true);
    setActiveTab("summary");
  }

  function handleSummarizeExecute(options: SummaryOptions) {
    tp.summarize(props.result.text, options).then((result) => {
      if (result) {
        toast.success(t("textProcessing.summarizeCompletedToast"));
      }
    });
  }

  function closeProcessingTab(tab: "proofread" | "summary") {
    if (tp.isProcessing()) tp.cancel();
    if (tab === "proofread") setProofreadActivated(false);
    else setSummaryActivated(false);
    setActiveTab("text");
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3">
      <ResultToolbar
        fileName={props.fileName}
        activeTab={activeTab()}
        onClose={props.onClose}
        onCopy={handleCopy}
        onSave={handleSave}
        onProofread={handleProofread}
        onSummarize={handleSummarize}
        onCancel={() => tp.cancel()}
        isProcessing={tp.isProcessing()}
      />
      <Tabs
        value={activeTab()}
        onChange={(value) => setActiveTab(value as ResultTab)}
        class="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="text">{t("result.textTab")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("result.timelineTab")}</TabsTrigger>
          <Show when={proofreadActivated()}>
            <TabsTrigger value="proofread" class="gap-1 pr-1.5">
              {t("result.proofreadTab")}
              <button
                type="button"
                class="ml-0.5 inline-flex items-center rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  closeProcessingTab("proofread");
                }}
              >
                <FiX class="size-3" />
              </button>
            </TabsTrigger>
          </Show>
          <Show when={summaryActivated()}>
            <TabsTrigger value="summary" class="gap-1 pr-1.5">
              {t("result.summaryTab")}
              <button
                type="button"
                class="ml-0.5 inline-flex items-center rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  closeProcessingTab("summary");
                }}
              >
                <FiX class="size-3" />
              </button>
            </TabsTrigger>
          </Show>
        </TabsList>
        <TabsContent value="text" class="mt-3 min-h-0 flex-1">
          <ResultTextTab text={props.result.text} />
        </TabsContent>
        <TabsContent value="timeline" class="mt-3 min-h-0 flex-1">
          <ResultTimelineTab segments={props.result.segments} />
        </TabsContent>
        <Show when={proofreadActivated()}>
          <TabsContent value="proofread" class="mt-3 min-h-0 flex-1">
            <ResultProofreadTab
              result={tp.proofreadResult()}
              inferenceProgress={tp.inferenceProgress()}
              isProcessing={tp.isProcessing()}
            />
          </TabsContent>
        </Show>
        <Show when={summaryActivated()}>
          <TabsContent value="summary" class="mt-3 min-h-0 flex-1">
            <ResultSummaryTab
              result={tp.summaryResult()}
              inferenceProgress={tp.inferenceProgress()}
              isProcessing={tp.isProcessing()}
              onSummarize={handleSummarizeExecute}
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
