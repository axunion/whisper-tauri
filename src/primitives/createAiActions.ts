import type { Accessor, Setter } from "solid-js";
import { createEffect, createSignal, on } from "solid-js";
import type { DictionaryKey } from "~/i18n/types";
import { toast } from "~/lib/toast";
import type { AiSession } from "~/primitives/createAiSession";
import type { createTextProcessing } from "~/primitives/createTextProcessing";
import { ErrorCode } from "~/types/errors";

export interface CreateAiActionsOptions {
  session: AiSession;
  tp: ReturnType<typeof createTextProcessing>;
  getResultText: () => string;
  onOpenSummary: () => void;
  onOpenCleanText: () => void;
  onTitleGenerated?: ((title: string) => void) | undefined;
  onGeneratingTitleChange?: ((generating: boolean) => void) | undefined;
  t: (key: DictionaryKey) => string;
}

export interface AiActions {
  onSummarize: () => void;
  onCleanText: () => void;
  onGenerateTitle: () => void;
  isReady: Accessor<boolean>;
  showPrereqDialog: Accessor<boolean>;
  setShowPrereqDialog: Setter<boolean>;
  pendingAction: Accessor<(() => void) | null>;
  cancelPending: () => void;
  confirmOverwrite: () => void;
}

/**
 * Drives the three AI actions (summarize / cleanText / generateTitle) with
 * shared prereq + overwrite-confirmation handling. View concerns (tab
 * switching) are injected as callbacks so this primitive stays decoupled.
 */
export function createAiActions(options: CreateAiActionsOptions): AiActions {
  const { session, tp, getResultText, t } = options;
  const [showPrereqDialog, setShowPrereqDialog] = createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<(() => void) | null>(
    null,
  );

  const isReady = tp.isReady;

  function runWithGuards(hasResult: boolean, action: () => void): void {
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

  // Surface failed AI actions the moment the session records an error —
  // keying on the error transition (rather than inferring failure from a
  // null result in each completion handler) avoids re-toasting stale errors
  // and covers future actions automatically. User cancellation stays silent.
  createEffect(
    on(
      session.error,
      (err) => {
        if (err && err.code !== ErrorCode.CANCELLED) {
          toast.error(t(err.messageKey));
        }
      },
      { defer: true },
    ),
  );

  function executeSummarize(): void {
    options.onOpenSummary();
    session.summarize(getResultText()).then((result) => {
      if (result) toast.success(t("textProcessing.summarizeCompletedToast"));
    });
  }

  function executeCleanText(): void {
    options.onOpenCleanText();
    session.cleanText(getResultText()).then((result) => {
      if (result) toast.success(t("textProcessing.cleanTextCompletedToast"));
    });
  }

  async function executeGenerateTitle(): Promise<void> {
    options.onGeneratingTitleChange?.(true);
    try {
      const result = await session.generateTitle(getResultText());
      if (result) {
        toast.success(t("textProcessing.titleGeneratedToast"));
        options.onTitleGenerated?.(result);
      }
    } finally {
      options.onGeneratingTitleChange?.(false);
    }
  }

  function onSummarize(): void {
    runWithGuards(session.summaryResult() !== null, executeSummarize);
  }

  function onCleanText(): void {
    runWithGuards(session.cleanTextResult() !== null, executeCleanText);
  }

  function onGenerateTitle(): void {
    runWithGuards(false, executeGenerateTitle);
  }

  function cancelPending(): void {
    setPendingAction(null);
  }

  function confirmOverwrite(): void {
    const action = pendingAction();
    setPendingAction(null);
    action?.();
  }

  return {
    onSummarize,
    onCleanText,
    onGenerateTitle,
    isReady,
    showPrereqDialog,
    setShowPrereqDialog,
    pendingAction,
    cancelPending,
    confirmOverwrite,
  };
}
