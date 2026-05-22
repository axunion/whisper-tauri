import { openUrl } from "@tauri-apps/plugin-opener";
import { FiExternalLink, FiLoader, FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createEffect, createMemo, Match, Show, Switch } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import type { NotionShareState } from "~/primitives/createNotionShare";

interface NotionShareDialogProps {
  state: () => NotionShareState;
  onClose: () => void;
  onRetry: () => void;
}

const NotionShareDialog: Component<NotionShareDialogProps> = (props) => {
  const { t } = useI18n();
  const kind = createMemo(() => props.state().kind);
  const open = createMemo(() => kind() !== "idle");
  const successState = createMemo(() => {
    const s = props.state();
    return s.kind === "success" ? s : null;
  });
  const errorState = createMemo(() => {
    const s = props.state();
    return s.kind === "error" ? s : null;
  });

  const titleText = createMemo(() => {
    switch (kind()) {
      case "sending":
        return t("notionShare.dialogTitle");
      case "success":
        return t("notionShare.successTitle");
      case "error":
        return t("notionShare.failureTitle");
      default:
        return "";
    }
  });

  const descriptionText = createMemo(() => {
    const s = props.state();
    switch (s.kind) {
      case "sending":
        return t("notionShare.sending");
      case "success":
        return s.pageRef.partial
          ? t("notionShare.successPartialNote")
          : t("notionShare.successDescription");
      case "error":
        return s.message;
      default:
        return "";
    }
  });

  const isSending = createMemo(() => kind() === "sending");

  let successCloseRef: HTMLButtonElement | undefined;
  let errorCloseRef: HTMLButtonElement | undefined;

  createEffect(() => {
    const k = kind();
    if (k !== "success" && k !== "error") return;
    queueMicrotask(() => {
      const ref = k === "success" ? successCloseRef : errorCloseRef;
      ref?.focus();
    });
  });

  function handleOpenChange(next: boolean) {
    if (!next && !isSending()) {
      props.onClose();
    }
  }

  return (
    <AlertDialog open={open()} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle class={isSending() ? "sr-only" : undefined}>
          {titleText()}
        </AlertDialogTitle>
        <AlertDialogDescription class={isSending() ? "sr-only" : undefined}>
          {descriptionText()}
        </AlertDialogDescription>

        <Show when={isSending()}>
          <div
            role="status"
            aria-live="polite"
            class="flex flex-col items-center justify-center gap-3 py-6"
          >
            <FiLoader
              class="size-8 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
            <p class="text-sm text-muted-foreground" aria-hidden="true">
              {descriptionText()}
            </p>
          </div>
        </Show>

        <Switch>
          <Match when={successState()}>
            {(success) => (
              <div class="flex justify-end gap-2">
                <Button
                  ref={successCloseRef}
                  variant="outline"
                  class="w-32"
                  onClick={props.onClose}
                >
                  <FiX class="size-4" />
                  {t("common.close")}
                </Button>
                <Button
                  class="w-40"
                  onClick={() => {
                    void openUrl(success().pageRef.url);
                    props.onClose();
                  }}
                >
                  <FiExternalLink class="size-4" />
                  {t("notionShare.openInNotion")}
                </Button>
              </div>
            )}
          </Match>
          <Match when={errorState()}>
            <div class="flex justify-end gap-2">
              <Button
                ref={errorCloseRef}
                variant="outline"
                class="w-32"
                onClick={props.onClose}
              >
                <FiX class="size-4" />
                {t("common.close")}
              </Button>
              <Button class="w-32" onClick={props.onRetry}>
                {t("common.retry")}
              </Button>
            </div>
          </Match>
        </Switch>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export { NotionShareDialog };
