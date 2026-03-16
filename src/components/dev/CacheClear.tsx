import { FiTrash2, FiX } from "solid-icons/fi";
import { createSignal } from "solid-js";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import type { createHistory } from "~/primitives/createHistory";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/AlertDialog";
import { Button } from "../ui/Button";

interface CacheClearProps {
  history: ReturnType<typeof createHistory>;
}

export function CacheClear(props: CacheClearProps) {
  const { t } = useI18n();
  const [historyOpen, setHistoryOpen] = createSignal(false);

  return (
    <div class="flex items-center justify-between rounded-lg border p-4">
      <p class="text-sm font-medium">{t("dev.clearHistory")}</p>
      <AlertDialog open={historyOpen()} onOpenChange={setHistoryOpen}>
        <AlertDialogTrigger
          as={Button}
          variant="destructive"
          size="sm"
          class="w-28"
        >
          <FiTrash2 />
          {t("dev.clearHistory")}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>{t("dev.clearHistory")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dev.clearHistoryConfirmation")}
          </AlertDialogDescription>
          <div class="flex justify-end gap-2">
            <AlertDialogTrigger as={Button} variant="outline" class="w-32">
              <FiX />
              {t("common.cancel")}
            </AlertDialogTrigger>
            <Button
              variant="destructive"
              class="w-32"
              onClick={async () => {
                await props.history.deleteAllEntries();
                setHistoryOpen(false);
                toast.success(t("dev.historyClearedToast"));
              }}
            >
              <FiTrash2 />
              {t("dev.deleteAll")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
