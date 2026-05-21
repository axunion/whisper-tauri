import { openUrl } from "@tauri-apps/plugin-opener";
import { FiExternalLink, FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createMemo, Match, Switch } from "solid-js";
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
  const open = createMemo(() => props.state().kind !== "idle");
  const successState = createMemo(() => {
    const s = props.state();
    return s.kind === "success" ? s : null;
  });
  const errorState = createMemo(() => {
    const s = props.state();
    return s.kind === "error" ? s : null;
  });

  function handleOpenChange(next: boolean) {
    if (!next && props.state().kind !== "sending") {
      props.onClose();
    }
  }

  return (
    <AlertDialog open={open()} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <Switch>
          <Match when={props.state().kind === "sending"}>
            <AlertDialogTitle>{t("notionShare.dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("notionShare.sending")}
            </AlertDialogDescription>
          </Match>

          <Match when={successState()}>
            {(success) => (
              <>
                <AlertDialogTitle>
                  {t("notionShare.successTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {success().pageRef.partial
                    ? t("notionShare.successPartialNote")
                    : t("notionShare.successDescription")}
                </AlertDialogDescription>
                <div class="flex justify-end gap-2">
                  <Button
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
              </>
            )}
          </Match>

          <Match when={errorState()}>
            {(error) => (
              <>
                <AlertDialogTitle>
                  {t("notionShare.failureTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {error().message}
                </AlertDialogDescription>
                <div class="flex justify-end gap-2">
                  <Button
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
              </>
            )}
          </Match>
        </Switch>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export { NotionShareDialog };
