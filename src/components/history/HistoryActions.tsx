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
import { CheckIndicator } from "~/components/history/CheckIndicator";
import { useSidebar } from "~/components/ui/sidebar";
import { useI18n } from "~/i18n";

interface HistoryActionsProps {
  visible: boolean;
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
        class="pointer-events-none fixed bottom-3 right-0 z-40 flex justify-center transition-[opacity,transform,left] duration-200 ease-linear"
        classList={{
          "opacity-100 translate-y-0": props.visible,
          "opacity-0 translate-y-full": !props.visible,
        }}
        style={{ left: sidebarOffset() }}
      >
        <div class="pointer-events-auto flex items-center gap-8 rounded-2xl border border-border/30 bg-card/30 px-12 py-2 shadow-2xl backdrop-blur-sm dark:bg-card/20">
          <div class="flex items-center gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={allSelected() ? true : hasSelection() ? "mixed" : false}
              class="flex scale-110 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                allSelected()
                  ? props.onClearSelection()
                  : props.onSelectAll()
              }
              disabled={props.totalCount === 0}
            >
              <CheckIndicator
                checked={allSelected()}
                indeterminate={hasSelection() && !allSelected()}
              />
            </button>
            <span class="text-sm tabular-nums text-muted-foreground">
              {t("history.selectedCount", { count: props.selectedCount })}
            </span>
          </div>

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
