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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
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
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    history.loadEntries();
  });

  onCleanup(() => clearTimeout(debounceTimer));

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
    }
  }

  const shouldHideList = () => {
    const len = rawInput().trim().length;
    if (len === 0) return false;
    if (len < SEARCH_MIN_LENGTH) return true;
    return isWaitingForSearch();
  };

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      <ErrorDisplay
        error={history.error()}
        onDismiss={() => history.clearError()}
      />

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle class="flex items-center justify-between">
            <span>{t("history.transcriptionHistory")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          {/* Row 1: Search + Sort */}
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <SearchBar
                onInput={handleSearchInput}
                onClear={handleClearSearch}
              />
            </div>
            <SortSelect
              value={history.filter().sortBy ?? "date"}
              onChange={handleSortChange}
            />
          </div>

          {/* Row 2: Selection actions (left) + Quick filter chips (right) */}
          <div class="flex items-center">
            <HistoryActions
              selectedCount={history.selectedIds().size}
              totalCount={history.entries().length}
              onSelectAll={() => history.selectAll()}
              onClearSelection={() => history.clearSelection()}
              onDeleteSelected={handleDeleteSelected}
            />
            <div class="ml-auto">
              <HistoryFilter
                filter={history.filter()}
                onFilterChange={handleFilterChange}
              />
            </div>
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
                onToggleSelect={(id) => history.toggleSelect(id)}
                onViewEntry={(id) => history.getEntry(id)}
              />
            </Show>
          </Show>
        </CardContent>
      </Card>

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
  );
}
