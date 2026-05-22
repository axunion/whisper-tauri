import { FiLoader, FiX } from "solid-icons/fi";
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
  const errorState = createMemo(() => {
    const s = props.state();
    return s.kind === "error" ? s : null;
  });

  const titleText = createMemo(() => {
    switch (kind()) {
      case "sending":
        return t("notionShare.dialogTitle");
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
      case "error":
        return s.message;
      default:
        return "";
    }
  });

  const isSending = createMemo(() => kind() === "sending");

  let errorCloseRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (kind() !== "error") return;
    queueMicrotask(() => {
      errorCloseRef?.focus();
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
