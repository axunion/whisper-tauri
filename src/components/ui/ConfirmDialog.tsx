import { FiX } from "solid-icons/fi";
import type { JSX } from "solid-js";
import { createSignal } from "solid-js";
import { useI18n } from "~/i18n";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./AlertDialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  children: (openDialog: () => void) => JSX.Element;
  title: string | JSX.Element;
  description: string | JSX.Element;
  confirmLabel: JSX.Element;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = createSignal(false);

  return (
    <>
      {props.children(() => setOpen(true))}
      <AlertDialog open={open()} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
          <div class="flex justify-end gap-2">
            <Button
              variant="outline"
              class="w-32"
              onClick={() => setOpen(false)}
            >
              <FiX />
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              class="w-32"
              onClick={async () => {
                await props.onConfirm();
                setOpen(false);
              }}
            >
              {props.confirmLabel}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
