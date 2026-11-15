import { FiCheck, FiCheckSquare, FiX } from "solid-icons/fi";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  HistoryActions,
  HistoryDetail,
  HistoryFilter,
  HistoryList,
  HistoryProcessingCloseDialog,
  SearchBar,
  SortToggleGroup,
} from "~/components/history";
import { Button } from "~/components/ui/Button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/Sheet";
import { useI18n } from "~/i18n";
import { runWithToast } from "~/lib/actionToast";
import { toast } from "~/lib/toast";
import type { AiOperation } from "~/primitives/createAiSession";
import { createHistory } from "~/primitives/createHistory";
import type { HistorySortBy, SortOrder } from "~/types";

export default function History() {
  const { t } = useI18n();
  const history = createHistory();
  const [selectionMode, setSelectionMode] = createSignal(false);
  const [currentOp, setCurrentOp] = createSignal<AiOperation>(null);
  const [cancelFn, setCancelFn] = createSignal<(() => Promise<void>) | null>(
    null,
  );
  const [showCloseDialog, setShowCloseDialog] = createSignal(false);

  createEffect(() => {
    if (!history.selectedEntry()) {
      setCurrentOp(null);
      setCancelFn(null);
    }
  });

  function attemptClose(): void {
    if (currentOp() !== null) {
      setShowCloseDialog(true);
      return;
    }
    history.clearSelectedEntry();
  }

  async function confirmCloseWithCancel(): Promise<void> {
    const fn = cancelFn();
    if (fn) await fn();
    toast.info(t("history.processingCancelledToast"));
    history.clearSelectedEntry();
    setShowCloseDialog(false);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && selectionMode()) {
      exitSelectionMode();
    }
  }

  onMount(() => {
    history.loadEntries();
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  function exitSelectionMode(): void {
    setSelectionMode(false);
    history.clearSelection();
  }

  function enterSelectionMode(id: string): void {
    setSelectionMode(true);
    history.toggleSelect(id);
  }

  function handleSortChange(sortBy: HistorySortBy, sortOrder: SortOrder): void {
    void history.updateFilter({ ...history.filter(), sortBy, sortOrder });
  }

  async function handleDeleteSelected(): Promise<void> {
    const ids = [...history.selectedIds()];
    if (ids.length > 0) {
      await runWithToast({
        action: () => history.deleteEntries(ids),
        successKey: "history.deletedToast",
        error: history.error,
        t,
      });
      if (history.selectedIds().size === 0) {
        setSelectionMode(false);
      }
    }
  }

  const highlightKeywords = () =>
    history.isSearching() ? history.searchQuery().split(/\s+/) : [];

  return (
    <>
      <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-4">
        <ErrorDisplay
          error={history.error()}
          onDismiss={() => history.clearError()}
        />

        {/* Row 1: Search + Select */}
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <SearchBar
              onInput={history.updateQuery}
              onClear={history.clearQuery}
            />
          </div>
          <Button
            variant={selectionMode() ? "default" : "outline"}
            size="sm"
            class="h-9"
            onClick={() =>
              selectionMode() ? exitSelectionMode() : setSelectionMode(true)
            }
          >
            {selectionMode() ? <FiCheck /> : <FiCheckSquare />}
            {selectionMode() ? t("common.done") : t("history.select")}
          </Button>
        </div>

        {/* Row 2: Filter + Sort */}
        <div class="flex items-center justify-between">
          <HistoryFilter
            filter={history.filter()}
            onFilterChange={history.updateFilter}
          />
          <SortToggleGroup
            sortBy={history.filter().sortBy ?? "date"}
            sortOrder={history.filter().sortOrder ?? "desc"}
            onChange={handleSortChange}
          />
        </div>

        {/* List */}
        <Show when={history.hasLoaded() && !history.queryPending()}>
          <Show
            when={!history.isSearching() || history.entries().length > 0}
            fallback={
              <div class="flex min-h-48 flex-col items-center justify-center text-muted-foreground">
                <p class="text-sm">{t("history.searchNoResults")}</p>
              </div>
            }
          >
            <HistoryList
              entries={history.entries()}
              selectedIds={history.selectedIds()}
              selectionMode={selectionMode()}
              highlightKeywords={highlightKeywords()}
              onToggleSelect={(id) => history.toggleSelect(id)}
              onViewEntry={(id) => history.getEntry(id)}
              onEnterSelectionMode={enterSelectionMode}
            />
            <Show when={history.hasMore()}>
              <div class="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={history.isLoading()}
                  onClick={() => void history.loadMore()}
                >
                  {t("history.loadMore")}
                </Button>
              </div>
            </Show>
          </Show>
        </Show>

        <Sheet
          open={!!history.selectedEntry()}
          onOpenChange={(open) => {
            if (!open) attemptClose();
          }}
        >
          <SheetContent class="max-w-none sm:max-w-none p-8">
            <SheetTitle class="sr-only">{t("history.detail")}</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              class="absolute left-2 top-2 size-7 text-muted-foreground"
              aria-label={t("common.close")}
              onClick={attemptClose}
            >
              <FiX class="size-4" aria-hidden="true" />
            </Button>
            {/* Keyed on the id, not the entry object: a rename replaces the
                object, and remounting the detail then would cancel a running
                AI action and reset the open tab. */}
            <Show when={history.selectedEntry()?.id} keyed>
              {(_id) => (
                <Show when={history.selectedEntry()}>
                  {(entry) => (
                    <HistoryDetail
                      entry={entry()}
                      onRename={history.renameEntry}
                      onProcessingChange={(op, cancel) => {
                        setCurrentOp(op);
                        setCancelFn(() => cancel);
                      }}
                    />
                  )}
                </Show>
              )}
            </Show>
          </SheetContent>
        </Sheet>

        <HistoryProcessingCloseDialog
          open={showCloseDialog}
          operation={currentOp}
          onOpenChange={setShowCloseDialog}
          onConfirm={confirmCloseWithCancel}
        />
      </div>

      <HistoryActions
        visible={selectionMode()}
        selectedCount={history.selectedIds().size}
        totalCount={history.entries().length}
        onSelectAll={() => history.selectAll()}
        onClearSelection={() => history.clearSelection()}
        onDeleteSelected={handleDeleteSelected}
      />
    </>
  );
}
