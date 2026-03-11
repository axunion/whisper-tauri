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
import { useSidebar } from "~/components/ui/sidebar";
import { useI18n } from "~/i18n";

interface HistoryActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void | Promise<void>;
}

const HistoryActions: Component<HistoryActionsProps> = (props) => {
  const { t } = useI18n();
  const sidebar = useSidebar();
  const [deleteSelectedOpen, setDeleteSelectedOpen] = createSignal(false);

  const allSelected = () =>
    props.totalCount > 0 && props.selectedCount === props.totalCount;
  const hasSelection = () => props.selectedCount > 0;

  const sidebarOffset = () =>
    sidebar.state() === "expanded"
      ? "var(--sidebar-width)"
      : "var(--sidebar-width-icon)";

  return (
    <>
      <div
        class="fixed bottom-6 right-0 z-40 flex justify-center transition-[left] duration-200 ease-linear"
        style={{ left: sidebarOffset() }}
      >
        <div class="flex items-center gap-5 rounded-2xl border border-border/30 bg-card/30 px-10 py-2.5 shadow-2xl backdrop-blur-sm dark:bg-card/20 animate-slide-up">
          <Checkbox
            checked={allSelected()}
            indeterminate={hasSelection() && !allSelected()}
            onChange={() =>
              allSelected() ? props.onClearSelection() : props.onSelectAll()
            }
            disabled={props.totalCount === 0}
            class="scale-110"
          />

          <span class="text-sm tabular-nums text-muted-foreground">
            {t("history.selectedCount", { count: props.selectedCount })}
          </span>

          <Button
            variant="destructive"
            size="sm"
            class="px-4"
            onClick={() => setDeleteSelectedOpen(true)}
            disabled={!hasSelection()}
          >
            <FiTrash2 class="mr-1.5 size-3.5" />
            {t("common.delete")}
          </Button>
        </div>
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
    </>
  );
};

export { HistoryActions };
