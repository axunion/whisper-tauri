import { useNavigate } from "@solidjs/router";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Component, JSX } from "solid-js";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";
import { exportResult, getExtension } from "~/lib/export";
import { formatSummaryAsText } from "~/lib/format";
import { toast } from "~/lib/toast";
import { createAiActions } from "~/primitives/createAiActions";
import type { AiOperation } from "~/primitives/createAiSession";
import { createAiSession } from "~/primitives/createAiSession";
import { createNotionSettings } from "~/primitives/createNotionSettings";
import { createNotionShare } from "~/primitives/createNotionShare";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type { TranscriptionResult } from "~/types";
import { AiActionDialogs } from "./AiActionDialogs";
import { NotionShareDialog } from "./NotionShareDialog";
import { ResultCleanTextTab } from "./ResultCleanTextTab";
import { ResultSummaryTab } from "./ResultSummaryTab";
import { ResultTextTab } from "./ResultTextTab";
import { ResultTimelineTab } from "./ResultTimelineTab";
import type { ResultTab } from "./ResultToolbar";
import { ResultToolbar } from "./ResultToolbar";

interface ResultViewerProps {
  result: TranscriptionResult;
  fileName?: JSX.Element | undefined;
  fileNameText: string;
  historyId?: string | undefined;
  onClose?: (() => void) | undefined;
  onTitleGenerated?: ((title: string) => void) | undefined;
  onGeneratingTitleChange?: ((generating: boolean) => void) | undefined;
  onProcessingChange?:
    | ((operation: AiOperation, cancel: () => Promise<void>) => void)
    | undefined;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<ResultTab>("text");
  const [summaryTabRequested, setSummaryTabRequested] = createSignal(false);
  const [cleanTextTabRequested, setCleanTextTabRequested] = createSignal(false);
  const tp = createTextProcessing();
  const session = createAiSession(() => props.historyId);
  const notion = createNotionSettings();
  const notionShare = createNotionShare();

  const actions = createAiActions({
    session,
    tp,
    getResultText: () => props.result.text,
    onOpenSummary: () => {
      setSummaryTabRequested(true);
      setActiveTab("summary");
    },
    onOpenCleanText: () => {
      setCleanTextTabRequested(true);
      setActiveTab("cleanText");
    },
    onTitleGenerated: props.onTitleGenerated,
    onGeneratingTitleChange: props.onGeneratingTitleChange,
    t,
  });

  const summaryTabVisible = () =>
    summaryTabRequested() ||
    session.summaryResult() !== null ||
    (session.isProcessing() && session.currentOperation() === "summary");

  const cleanTextTabVisible = () =>
    cleanTextTabRequested() || session.cleanTextResult() !== null;

  onMount(() => {
    tp.checkServer();
    tp.loadModels();
    void notion.load();
  });

  createEffect(() => {
    props.onProcessingChange?.(session.currentOperation(), session.cancel);
  });

  function getCopyText(): string {
    const tab = activeTab();
    if (tab === "summary") {
      const summary = session.summaryResult();
      return summary ? formatSummaryAsText(summary) : "";
    }
    if (tab === "cleanText") {
      return session.cleanTextResult() ?? "";
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

  async function performSave(opts: {
    title: string;
    filter: string;
    ext: string;
    defaultPath: string;
    content: string;
  }) {
    try {
      const filePath = await save({
        title: opts.title,
        filters: [{ name: opts.filter, extensions: [opts.ext] }],
        defaultPath: opts.defaultPath,
      });
      if (!filePath) return;
      await writeTextFile(filePath, opts.content);
      toast.success(t("result.savedToast"));
    } catch {
      toast.error(t("result.saveFailedToast"));
    }
  }

  async function handleSave(fmt: ExportFormat) {
    await performSave({
      title: t("dialog.saveTranscriptionTitle"),
      filter: t(`dialog.${fmt}Filter`),
      ext: fmt,
      defaultPath: `transcription${getExtension(fmt)}`,
      content: exportResult(props.result, fmt),
    });
  }

  async function handleDirectSave() {
    const tab = activeTab();
    if (tab === "summary") {
      const summary = session.summaryResult();
      if (!summary) return;
      await performSave({
        title: t("dialog.saveSummaryTitle"),
        filter: t("dialog.mdFilter"),
        ext: "md",
        defaultPath: "transcription-summary.md",
        content: formatSummaryAsText(summary),
      });
      return;
    }
    if (tab === "cleanText") {
      const cleaned = session.cleanTextResult();
      if (!cleaned) return;
      await performSave({
        title: t("dialog.saveCleanTextTitle"),
        filter: t("dialog.txtFilter"),
        ext: "txt",
        defaultPath: "transcription-cleaned.txt",
        content: cleaned,
      });
    }
  }

  const canSave = () => {
    const tab = activeTab();
    if (tab === "summary") {
      return (
        session.summaryResult() !== null &&
        !(session.isProcessing() && session.currentOperation() === "summary")
      );
    }
    if (tab === "cleanText") {
      return (
        session.cleanTextResult() !== null &&
        !(session.isProcessing() && session.currentOperation() === "cleanText")
      );
    }
    return props.result.text.length > 0;
  };

  async function handleShareToNotion() {
    const text = getCopyText();
    if (!text.trim()) {
      toast.error(t("notionShare.emptyContentToast"));
      return;
    }
    await notionShare.share({
      title: props.fileNameText.trim() || "Untitled",
      bodyText: text,
    });
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3">
      <ResultToolbar
        fileName={props.fileName}
        activeTab={activeTab()}
        onClose={props.onClose}
        onCopy={handleCopy}
        onSave={handleSave}
        onDirectSave={handleDirectSave}
        onSummarize={actions.onSummarize}
        onCleanText={actions.onCleanText}
        onGenerateTitle={actions.onGenerateTitle}
        onShareToNotion={() => {
          void handleShareToNotion();
        }}
        onOpenNotionSetup={() => navigate("/settings")}
        isProcessing={session.isProcessing()}
        isGeneratingTitle={session.isGeneratingTitle()}
        isNotionConnected={notion.isConfigured()}
        isSharingToNotion={notionShare.state().kind === "sending"}
        canSave={canSave()}
      />
      <Tabs
        value={activeTab()}
        onChange={(value) => setActiveTab(value as ResultTab)}
        class="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="text">{t("result.textTab")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("result.timelineTab")}</TabsTrigger>
          <Show when={cleanTextTabVisible()}>
            <TabsTrigger value="cleanText">
              {t("result.cleanTextTab")}
            </TabsTrigger>
          </Show>
          <Show when={summaryTabVisible()}>
            <TabsTrigger value="summary">{t("result.summaryTab")}</TabsTrigger>
          </Show>
        </TabsList>
        <TabsContent value="text" class="mt-3 min-h-0 flex-1">
          <ResultTextTab text={props.result.text} />
        </TabsContent>
        <TabsContent value="timeline" class="mt-3 min-h-0 flex-1">
          <ResultTimelineTab segments={props.result.segments} />
        </TabsContent>
        <Show when={cleanTextTabVisible()}>
          <TabsContent value="cleanText" class="mt-3 min-h-0 flex-1">
            <ResultCleanTextTab
              cleanTextResult={session.cleanTextResult()}
              isProcessing={
                session.isProcessing() &&
                session.currentOperation() === "cleanText"
              }
              onCancel={() => session.cancel()}
            />
          </TabsContent>
        </Show>
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
      </Tabs>

      <AiActionDialogs
        showPrereq={actions.showPrereqDialog}
        onPrereqOpenChange={actions.setShowPrereqDialog}
        onGoToSettings={() => {
          actions.setShowPrereqDialog(false);
          navigate("/settings");
        }}
        showOverwrite={() => actions.pendingAction() !== null}
        onOverwriteOpenChange={(open) => {
          if (!open) actions.cancelPending();
        }}
        onConfirmOverwrite={actions.confirmOverwrite}
      />

      <NotionShareDialog
        state={notionShare.state}
        onClose={notionShare.reset}
        onRetry={() => {
          void handleShareToNotion();
        }}
      />
    </div>
  );
};

export { ResultViewer };
