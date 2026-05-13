import { FiTrash2 } from "solid-icons/fi";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { SectionRow } from "~/components/ui/SectionRow";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import type { createHistory } from "~/primitives/createHistory";

interface CacheClearProps {
  history: ReturnType<typeof createHistory>;
}

export function CacheClear(props: CacheClearProps) {
  const { t } = useI18n();

  return (
    <SectionRow
      title={t("dev.clearHistory")}
      right={
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
      }
    />
  );
}
