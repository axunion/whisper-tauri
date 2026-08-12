import { FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createMemo } from "solid-js";
import { CheckIndicator } from "~/components/history/CheckIndicator";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
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

  const allSelected = () =>
    props.totalCount > 0 && props.selectedCount === props.totalCount;
  const hasSelection = () => props.selectedCount > 0;
  const indeterminate = createMemo(() => hasSelection() && !allSelected());

  const sidebarOffset = () =>
    sidebar.state() === "expanded"
      ? "var(--sidebar-width)"
      : "var(--sidebar-width-icon)";

  return (
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
          <label class="relative flex scale-110 items-center justify-center peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
            <input
              type="checkbox"
              checked={allSelected()}
              class="peer sr-only"
              aria-label={t("history.selectAll")}
              onChange={() =>
                allSelected() ? props.onClearSelection() : props.onSelectAll()
              }
              disabled={props.totalCount === 0}
            />
            <span
              aria-hidden="true"
              class="rounded-sm ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
            >
              <CheckIndicator
                checked={allSelected()}
                indeterminate={indeterminate()}
              />
            </span>
          </label>
          <span class="text-sm tabular-nums text-muted-foreground">
            {t("history.selectedCount", { count: props.selectedCount })}
          </span>
        </div>

        <ConfirmDialog
          title={t("history.deleteSelected")}
          description={t("history.deleteConfirmation", {
            count: props.selectedCount,
          })}
          confirmLabel={
            <>
              <FiTrash2 />
              {t("common.delete")}
            </>
          }
          onConfirm={props.onDeleteSelected}
        >
          {(openDialog) => (
            <Button
              variant="destructive"
              size="sm"
              class="px-4"
              onClick={openDialog}
              disabled={!hasSelection()}
            >
              <FiTrash2 />
              {t("common.delete")}
            </Button>
          )}
        </ConfirmDialog>
      </div>
    </div>
  );
};

export { HistoryActions };
