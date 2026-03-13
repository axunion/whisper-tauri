import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  HistoryActions,
  HistoryDetail,
  HistoryFilter,
  HistoryList,
  SearchBar,
  SortSelect,
} from "~/components/history";
import { Button } from "~/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/Sheet";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createHistory } from "~/primitives/createHistory";
import type {
  HistoryFilter as HistoryFilterType,
  HistorySortBy,
} from "~/types";

const SEARCH_MIN_LENGTH = 3;
const DEBOUNCE_MS = 300;

export default function History() {
  const { t } = useI18n();
  const history = createHistory();
  const [rawInput, setRawInput] = createSignal("");
  const [isWaitingForSearch, setIsWaitingForSearch] = createSignal(false);
  const [selectionMode, setSelectionMode] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

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
    clearTimeout(debounceTimer);
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

  function handleSearchInput(value: string): void {
    setRawInput(value);
    clearTimeout(debounceTimer);

    const trimmed = value.trim();
    if (!trimmed) {
      setIsWaitingForSearch(false);
      history.clearSearch();
      history.loadEntries();
    } else if (trimmed.length >= SEARCH_MIN_LENGTH) {
      if (!history.isSearching()) {
        setIsWaitingForSearch(true);
      }
      debounceTimer = setTimeout(() => {
        history.searchEntries(trimmed).finally(() => {
          setIsWaitingForSearch(false);
        });
      }, DEBOUNCE_MS);
    } else if (history.isSearching()) {
      setIsWaitingForSearch(false);
      history.clearSearch();
    }
  }

  function handleClearSearch(): void {
    setRawInput("");
    setIsWaitingForSearch(false);
    history.clearSearch();
    history.loadEntries();
  }

  async function handleFilterChange(filter: HistoryFilterType): Promise<void> {
    history.updateFilter(filter);
    const trimmed = rawInput().trim();
    if (trimmed.length >= SEARCH_MIN_LENGTH) {
      setIsWaitingForSearch(true);
      await history.searchEntries(trimmed);
      setIsWaitingForSearch(false);
    } else if (!trimmed) {
      await history.loadEntries();
    }
  }

  function handleSortChange(sortBy: HistorySortBy): void {
    handleFilterChange({ ...history.filter(), sortBy });
  }

  async function handleDeleteSelected(): Promise<void> {
    const ids = [...history.selectedIds()];
    if (ids.length > 0) {
      await history.deleteEntries(ids);
      toast.success(t("history.deletedToast"));
      if (history.selectedIds().size === 0) {
        setSelectionMode(false);
      }
    }
  }

  const shouldHideList = () => {
    const len = rawInput().trim().length;
    if (len === 0) return false;
    if (len < SEARCH_MIN_LENGTH) return true;
    return isWaitingForSearch();
  };

  return (
    <>
      <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-4">
        <ErrorDisplay
          error={history.error()}
          onDismiss={() => history.clearError()}
        />

        {/* Toolbar: grid with fixed column tracks */}
        <div class="grid grid-cols-[1fr_130px_130px_72px] items-center gap-2">
          <SearchBar onInput={handleSearchInput} onClear={handleClearSearch} />
          <HistoryFilter
            filter={history.filter()}
            onFilterChange={handleFilterChange}
          />
          <SortSelect
            value={history.filter().sortBy ?? "date"}
            onChange={handleSortChange}
          />
          <Button
            variant={selectionMode() ? "default" : "outline"}
            size="sm"
            class="h-9"
            onClick={() =>
              selectionMode() ? exitSelectionMode() : setSelectionMode(true)
            }
          >
            {selectionMode() ? t("common.done") : t("history.select")}
          </Button>
        </div>

        {/* List */}
        <Show when={!shouldHideList()}>
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
              onToggleSelect={(id) => history.toggleSelect(id)}
              onViewEntry={(id) => history.getEntry(id)}
              onEnterSelectionMode={enterSelectionMode}
            />
          </Show>
        </Show>

        <Sheet
          open={!!history.selectedEntry()}
          onOpenChange={(open) => {
            if (!open) history.clearSelectedEntry();
          }}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t("history.detail")}</SheetTitle>
              <SheetDescription>
                {t("history.detailDescription")}
              </SheetDescription>
            </SheetHeader>
            <Show when={history.selectedEntry()} keyed>
              {(entry) => <HistoryDetail entry={entry} />}
            </Show>
          </SheetContent>
        </Sheet>
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
