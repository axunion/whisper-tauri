import { FiCheckSquare, FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface HistoryActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

const HistoryActions: Component<HistoryActionsProps> = (props) => {
  const { t } = useI18n();
  const [deleteSelectedOpen, setDeleteSelectedOpen] = createSignal(false);

  const allSelected = () =>
    props.totalCount > 0 && props.selectedCount === props.totalCount;

  return (
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          allSelected() ? props.onClearSelection() : props.onSelectAll()
        }
        disabled={props.totalCount === 0}
      >
        <FiCheckSquare class="size-4" />
        {allSelected() ? t("history.deselectAll") : t("history.selectAll")}
      </Button>

      <Show when={props.selectedCount > 0}>
        <AlertDialog
          open={deleteSelectedOpen()}
          onOpenChange={setDeleteSelectedOpen}
        >
          <AlertDialogTrigger as={Button} variant="destructive" size="sm">
            <FiTrash2 class="size-4" />
            {t("history.deleteCount", { count: props.selectedCount })}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{t("history.deleteSelected")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("history.deleteConfirmation", { count: props.selectedCount })}
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteSelectedOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  props.onDeleteSelected();
                  setDeleteSelectedOpen(false);
                }}
              >
                {t("common.delete")}
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </Show>
    </div>
  );
};

export { HistoryActions };
