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
  const [confirming, setConfirming] = createSignal(false);

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
              disabled={confirming()}
              onClick={async () => {
                setConfirming(true);
                try {
                  await props.onConfirm();
                  setOpen(false);
                } finally {
                  setConfirming(false);
                }
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
