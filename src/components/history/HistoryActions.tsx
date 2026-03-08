import { FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";
import { Checkbox } from "~/components/ui/Checkbox";
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
  const hasSelection = () => props.selectedCount > 0;

  return (
    <div class="flex h-7 items-center gap-2.5">
      <Checkbox
        checked={allSelected()}
        indeterminate={hasSelection() && !allSelected()}
        onChange={() =>
          allSelected() ? props.onClearSelection() : props.onSelectAll()
        }
        disabled={props.totalCount === 0}
        class="scale-110"
      />

      <div
        class="flex items-center gap-1.5 transition-opacity duration-150"
        classList={{
          "opacity-0 pointer-events-none": !hasSelection(),
          "opacity-100": hasSelection(),
        }}
        aria-hidden={!hasSelection()}
      >
        <span class="text-xs tabular-nums text-muted-foreground">
          {props.selectedCount}
        </span>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteSelectedOpen(true)}
          title={t("history.deleteCount", { count: props.selectedCount })}
        >
          <FiTrash2 class="size-[18px]" />
        </button>
      </div>

      <AlertDialog
        open={deleteSelectedOpen()}
        onOpenChange={setDeleteSelectedOpen}
      >
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
    </div>
  );
};

export { HistoryActions };
