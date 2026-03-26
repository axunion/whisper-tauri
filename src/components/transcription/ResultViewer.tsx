import { useNavigate } from "@solidjs/router";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { FiSettings, FiX } from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
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
import { createAiSession } from "~/primitives/createAiSession";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type { TranscriptionResult } from "~/types";
import { ResultActionItemsTab } from "./ResultActionItemsTab";
import { ResultKeywordsTab } from "./ResultKeywordsTab";
import { ResultSummaryTab } from "./ResultSummaryTab";
import { ResultTextTab } from "./ResultTextTab";
import { ResultTimelineTab } from "./ResultTimelineTab";
import type { ResultTab } from "./ResultToolbar";
import { ResultToolbar } from "./ResultToolbar";

interface ResultViewerProps {
  result: TranscriptionResult;
  fileName?: JSX.Element | undefined;
  historyId?: string | undefined;
  onClose?: (() => void) | undefined;
  onTitleGenerated?: ((title: string) => void) | undefined;
  onGeneratingTitleChange?: ((generating: boolean) => void) | undefined;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<ResultTab>("text");
  const [showPrereqDialog, setShowPrereqDialog] = createSignal(false);
  const [summaryTabRequested, setSummaryTabRequested] = createSignal(false);
  const [keywordsTabRequested, setKeywordsTabRequested] = createSignal(false);
  const [actionItemsTabRequested, setActionItemsTabRequested] =
    createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<(() => void) | null>(
    null,
  );
  const tp = createTextProcessing();
  const session = createAiSession(() => props.historyId);

  const hasDownloadedModel = () => tp.models().some((m) => m.downloaded);
  const isReady = () => tp.serverAvailable() && hasDownloadedModel();

  const summaryTabVisible = () =>
    summaryTabRequested() ||
    session.summaryResult() !== null ||
    session.isProcessing();

  const keywordsTabVisible = () =>
    keywordsTabRequested() || session.keywordsResult() !== null;

  const actionItemsTabVisible = () =>
    actionItemsTabRequested() || session.actionItemsResult() !== null;

  onMount(() => {
    tp.checkServer();
    tp.loadModels();
  });

  function getCopyText(): string {
    const tab = activeTab();
    if (tab === "summary") {
      return session.summaryResult() ?? "";
    }
    if (tab === "keywords") {
      return session.keywordsResult() ?? "";
    }
    if (tab === "actionItems") {
      return session.actionItemsResult() ?? "";
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

  function executeSummarize() {
    setSummaryTabRequested(true);
    setActiveTab("summary");
    session.summarize(props.result.text).then((result) => {
      if (result) {
        toast.success(t("textProcessing.summarizeCompletedToast"));
      }
    });
  }

  function executeExtractKeywords() {
    setKeywordsTabRequested(true);
    setActiveTab("keywords");
    session.extractKeywords(props.result.text).then((result) => {
      if (result) {
        toast.success(t("textProcessing.keywordsCompletedToast"));
      }
    });
  }

  function executeExtractActionItems() {
    setActionItemsTabRequested(true);
    setActiveTab("actionItems");
    session.extractActionItems(props.result.text).then((result) => {
      if (result) {
        toast.success(t("textProcessing.actionItemsCompletedToast"));
      }
    });
  }

  async function executeGenerateTitle() {
    props.onGeneratingTitleChange?.(true);
    try {
      const result = await session.generateTitle(props.result.text);
      if (result) {
        toast.success(t("textProcessing.titleGeneratedToast"));
        props.onTitleGenerated?.(result);
      }
    } finally {
      props.onGeneratingTitleChange?.(false);
    }
  }

  /** Execute action, or show overwrite confirmation if results already exist. */
  function withOverwriteCheck(hasResult: boolean, action: () => void) {
    if (!isReady()) {
      setShowPrereqDialog(true);
      return;
    }
    if (hasResult) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  function confirmOverwrite() {
    const action = pendingAction();
    setPendingAction(null);
    action?.();
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3">
      <ResultToolbar
        fileName={props.fileName}
        activeTab={activeTab()}
        onClose={props.onClose}
        onCopy={handleCopy}
        onSave={handleSave}
        onSummarize={() =>
          withOverwriteCheck(session.summaryResult() !== null, executeSummarize)
        }
        onExtractKeywords={() =>
          withOverwriteCheck(
            session.keywordsResult() !== null,
            executeExtractKeywords,
          )
        }
        onExtractActionItems={() =>
          withOverwriteCheck(
            session.actionItemsResult() !== null,
            executeExtractActionItems,
          )
        }
        onGenerateTitle={() => {
          if (!isReady()) {
            setShowPrereqDialog(true);
            return;
          }
          executeGenerateTitle();
        }}
        isProcessing={session.isProcessing()}
        isGeneratingTitle={session.isGeneratingTitle()}
      />
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
          <Show when={actionItemsTabVisible()}>
            <TabsTrigger value="actionItems">
              {t("result.actionItemsTab")}
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
              summaryResult={session.summaryResult()}
              isProcessing={
                session.isProcessing() &&
                session.currentOperation() === "summary"
              }
              onCancel={() => session.cancel()}
            />
          </TabsContent>
        </Show>
        <Show when={keywordsTabVisible()}>
          <TabsContent value="keywords" class="mt-3 min-h-0 flex-1">
            <ResultKeywordsTab
              keywordsResult={session.keywordsResult()}
              isProcessing={
                session.isProcessing() &&
                session.currentOperation() === "keywords"
              }
              onCancel={() => session.cancel()}
            />
          </TabsContent>
        </Show>
        <Show when={actionItemsTabVisible()}>
          <TabsContent value="actionItems" class="mt-3 min-h-0 flex-1">
            <ResultActionItemsTab
              actionItemsResult={session.actionItemsResult()}
              isProcessing={
                session.isProcessing() &&
                session.currentOperation() === "actionItems"
              }
              onCancel={() => session.cancel()}
            />
          </TabsContent>
        </Show>
      </Tabs>

      {/* Prerequisite dialog */}
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

      {/* Overwrite confirmation dialog */}
      <AlertDialog
        open={pendingAction() !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("textProcessing.overwriteConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("textProcessing.overwriteConfirmDescription")}
          </AlertDialogDescription>
          <div class="flex justify-end gap-2">
            <Button
              variant="outline"
              class="w-32"
              onClick={() => setPendingAction(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button class="w-32" onClick={confirmOverwrite}>
              {t("common.confirm")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export { ResultViewer };
