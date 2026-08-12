import { useNavigate } from "@solidjs/router";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Component, JSX } from "solid-js";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";
import { exportResult, getExtension } from "~/lib/export";
import { formatSummaryAsText, formatTimeline } from "~/lib/format";
import { buildNotionPagePayload, type NotionMetaContext } from "~/lib/notion";
import { toast } from "~/lib/toast";
import { createAiActions } from "~/primitives/createAiActions";
import type { AiOperation } from "~/primitives/createAiSession";
import { createAiSession } from "~/primitives/createAiSession";
import { createNotionSettings } from "~/primitives/createNotionSettings";
import { createNotionShare } from "~/primitives/createNotionShare";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import type { StructuredSummary, TranscriptionResult } from "~/types";
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
  // Metadata for the Notion meta callout. Undefined entries are dropped by
  // the payload helper. History-detail callers omit `processingMs` because
  // the timing is not persisted to history yet.
  notionMeta?: NotionMetaContext | undefined;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<ResultTab>("text");
  const [summaryTabRequested, setSummaryTabRequested] = createSignal(false);
  const [cleanTextTabRequested, setCleanTextTabRequested] = createSignal(false);
  // Lock the Share button from invoke start until the success/error UX is
  // fully on screen — `notionShare.state().kind === "sending"` flips back
  // the instant invoke resolves, which would let a rapid double-click create
  // duplicate Notion pages before the user notices the toast.
  const [isSharingNotion, setIsSharingNotion] = createSignal(false);
  // Remember which tab the in-flight share is bound to so Retry resends the
  // same content even if the user switches tabs while the error dialog is up.
  const [failedShareTab, setFailedShareTab] = createSignal<ResultTab | null>(
    null,
  );
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

  type SaveOptions = {
    title: string;
    filter: string;
    ext: string;
    defaultPath: string;
    content: string;
  };

  type TabSpec = {
    /** What Copy puts on the clipboard. */
    copyText: () => string;
    /** Plain-text body for a Notion page; empty when summary blocks carry it. */
    notionBody: () => string;
    notionSummary: () => StructuredSummary | null;
    titleSuffixKey?: DictionaryKey;
    /**
     * Present only on tabs whose Save button writes the AI artifact straight to
     * disk, bypassing the export-format chooser.
     */
    directSave?: {
      hasResult: () => boolean;
      saveOptions: () => SaveOptions | null;
    };
  };

  // One table per tab, read by Copy, Save and Notion share alike, so the three
  // never drift in how they interpret a tab. Being a Record over ResultTab, a
  // new tab is a compile error until every consumer's behaviour is spelled out.
  const tabSpecs: Record<ResultTab, TabSpec> = {
    text: {
      copyText: () => props.result.text,
      notionBody: () => props.result.text,
      notionSummary: () => null,
    },
    timeline: {
      copyText: () => formatTimeline(props.result.segments),
      notionBody: () => formatTimeline(props.result.segments),
      notionSummary: () => null,
      titleSuffixKey: "notionShare.titleTimeline",
    },
    cleanText: {
      copyText: () => session.cleanTextResult() ?? "",
      notionBody: () => session.cleanTextResult() ?? "",
      notionSummary: () => null,
      titleSuffixKey: "notionShare.titleCleanText",
      directSave: {
        hasResult: () => session.cleanTextResult() !== null,
        saveOptions: () => {
          const cleaned = session.cleanTextResult();
          if (!cleaned) return null;
          return {
            title: t("dialog.saveCleanTextTitle"),
            filter: t("dialog.txtFilter"),
            ext: "txt",
            defaultPath: "transcription-cleaned.txt",
            content: cleaned,
          };
        },
      },
    },
    summary: {
      copyText: () => {
        const summary = session.summaryResult();
        return summary ? formatSummaryAsText(summary) : "";
      },
      notionBody: () => "",
      notionSummary: () => session.summaryResult(),
      titleSuffixKey: "notionShare.titleSummary",
      directSave: {
        hasResult: () => session.summaryResult() !== null,
        saveOptions: () => {
          const summary = session.summaryResult();
          if (!summary) return null;
          return {
            title: t("dialog.saveSummaryTitle"),
            filter: t("dialog.mdFilter"),
            ext: "md",
            defaultPath: "transcription-summary.md",
            content: formatSummaryAsText(summary),
          };
        },
      },
    },
  };

  async function handleCopy() {
    const text = tabSpecs[activeTab()].copyText();
    if (!text) return;
    try {
      await writeText(text);
      toast.success(t("result.copiedToast"));
    } catch {
      toast.error(t("result.copyFailedToast"));
    }
  }

  async function performSave(opts: SaveOptions) {
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
    const opts = tabSpecs[activeTab()].directSave?.saveOptions();
    if (opts) await performSave(opts);
  }

  const canSave = () => {
    const tab = activeTab();
    const directSave = tabSpecs[tab].directSave;
    if (!directSave) return props.result.text.length > 0;
    return (
      directSave.hasResult() &&
      !(session.isProcessing() && session.currentOperation() === tab)
    );
  };

  async function copyAndNotify(url: string) {
    try {
      await writeText(url);
      toast.success(t("notionShare.urlCopiedToast"));
    } catch (err) {
      console.error("Failed to copy Notion URL:", err);
      toast.error(t("notionShare.copyFailedToast"));
    }
  }

  function openNotionUrl(url: string) {
    openUrl(url).catch((err) => {
      console.error("Failed to open Notion URL:", err);
      toast.error(t("notionShare.copyFailedToast"));
    });
  }

  function notifyShareResult(ref: { url: string; partial: boolean }) {
    const toastActions = [
      {
        label: t("notionShare.openInNotion"),
        onClick: () => openNotionUrl(ref.url),
      },
      {
        label: t("notionShare.copyUrlAction"),
        onClick: () => {
          void copyAndNotify(ref.url);
        },
      },
    ];

    if (ref.partial) {
      toast.warning(t("notionShare.successPartialToastTitle"), {
        description: t("notionShare.successPartialNote"),
        actions: toastActions,
        duration: 8000,
      });
    } else {
      toast.success(t("notionShare.successToastTitle"), {
        actions: toastActions,
        duration: 6000,
      });
    }
  }

  async function handleShareToNotion(retryTab?: ResultTab) {
    if (isSharingNotion()) return;
    const tab = retryTab ?? activeTab();
    const spec = tabSpecs[tab];
    const notionSummary = spec.notionSummary();
    const notionBody = spec.notionBody();
    if (!notionSummary && !notionBody.trim()) {
      toast.error(t("notionShare.emptyContentToast"));
      // Clear any lingering error dialog so the toast isn't stacked on top.
      notionShare.reset();
      setFailedShareTab(null);
      return;
    }

    // Tag the page title with the tab kind so multiple sends from the same
    // recording stay distinguishable in the Notion DB list.
    const suffix = spec.titleSuffixKey ? ` (${t(spec.titleSuffixKey)})` : "";

    const payload = buildNotionPagePayload({
      title: `${props.fileNameText}${suffix}`,
      body: notionBody,
      meta: {
        ...(props.notionMeta ?? {}),
        fileName: props.fileNameText.trim() || undefined,
      },
      summary: notionSummary,
      t,
      locale: locale(),
    });
    setIsSharingNotion(true);
    try {
      const ref = await notionShare.share(payload);
      if (!ref) {
        setFailedShareTab(tab);
        return;
      }
      setFailedShareTab(null);
      notifyShareResult(ref);
    } finally {
      setIsSharingNotion(false);
    }
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
        isSharingToNotion={isSharingNotion()}
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
        onClose={() => {
          notionShare.reset();
          setFailedShareTab(null);
        }}
        onRetry={() => {
          const tab = failedShareTab();
          void handleShareToNotion(tab ?? undefined);
        }}
      />
    </div>
  );
};

export { ResultViewer };
