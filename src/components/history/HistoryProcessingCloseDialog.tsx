import type { Accessor, Component } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import type { AiOperation } from "~/primitives/createAiSession";

interface HistoryProcessingCloseDialogProps {
  open: Accessor<boolean>;
  operation: Accessor<AiOperation>;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const HistoryProcessingCloseDialog: Component<
  HistoryProcessingCloseDialogProps
> = (props) => {
  const { t } = useI18n();

  return (
    <AlertDialog open={props.open()} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{t("history.processingCloseTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {props.operation() === "summary"
            ? t("history.processingCloseSummaryDescription")
            : t("history.processingCloseCleanTextDescription")}
        </AlertDialogDescription>
        <div class="flex justify-end gap-2">
          <Button
            variant="outline"
            class="w-32"
            onClick={() => props.onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button class="w-32" onClick={props.onConfirm}>
            {t("history.processingCloseConfirm")}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export { HistoryProcessingCloseDialog };
