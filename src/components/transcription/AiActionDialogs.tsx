import { FiSettings, FiX } from "solid-icons/fi";
import type { Accessor, Component } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface AiActionDialogsProps {
  showPrereq: Accessor<boolean>;
  onPrereqOpenChange: (open: boolean) => void;
  onGoToSettings: () => void;
  showOverwrite: Accessor<boolean>;
  onOverwriteOpenChange: (open: boolean) => void;
  onConfirmOverwrite: () => void;
}

const AiActionDialogs: Component<AiActionDialogsProps> = (props) => {
  const { t } = useI18n();

  return (
    <>
      <AlertDialog
        open={props.showPrereq()}
        onOpenChange={props.onPrereqOpenChange}
      >
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
              onClick={() => props.onPrereqOpenChange(false)}
            >
              <FiX class="size-4" />
              {t("common.close")}
            </Button>
            <Button class="w-32" onClick={props.onGoToSettings}>
              <FiSettings class="size-4" />
              {t("nav.settings")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={props.showOverwrite()}
        onOpenChange={props.onOverwriteOpenChange}
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
              onClick={() => props.onOverwriteOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button class="w-32" onClick={props.onConfirmOverwrite}>
              {t("common.confirm")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export { AiActionDialogs };
