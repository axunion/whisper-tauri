import { FiTrash2 } from "solid-icons/fi";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import type { createHistory } from "~/primitives/createHistory";

interface CacheClearProps {
  history: ReturnType<typeof createHistory>;
}

export function CacheClear(props: CacheClearProps) {
  const { t } = useI18n();

  return (
    <div class="flex items-center justify-between rounded-lg border p-4">
      <p class="text-sm font-medium">{t("dev.clearHistory")}</p>
      <ConfirmDialog
        title={t("dev.clearHistory")}
        description={t("dev.clearHistoryConfirmation")}
        confirmLabel={
          <>
            <FiTrash2 />
            {t("dev.deleteAll")}
          </>
        }
        onConfirm={async () => {
          await props.history.deleteAllEntries();
          toast.success(t("dev.historyClearedToast"));
        }}
      >
        {(openDialog) => (
          <Button
            variant="destructive"
            size="sm"
            class="w-28"
            onClick={openDialog}
          >
            <FiTrash2 />
            {t("dev.clearHistory")}
          </Button>
        )}
      </ConfirmDialog>
    </div>
  );
}
