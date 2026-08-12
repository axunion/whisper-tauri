import { invoke } from "@tauri-apps/api/core";
import { createSignal, onCleanup } from "solid-js";
import { parseError } from "~/lib/errors";
import type {
  HistoryEntry,
  HistoryFilter,
  HistoryMeta,
  HistorySaveParams,
  HistorySearchParams,
} from "~/types";
import type { AppError } from "~/types/errors";

const DEFAULT_LIMIT = 200;

/** Shortest query worth sending to FTS — below this the list is held back. */
const SEARCH_MIN_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

export function createHistory() {
  const [entries, setEntries] = createSignal<HistoryMeta[]>([]);
  const [selectedEntry, setSelectedEntry] = createSignal<HistoryEntry | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(
    new Set<string>(),
  );
  const [filter, setFilter] = createSignal<HistoryFilter>({});
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSearching, setIsSearching] = createSignal(false);
  const [error, setError] = createSignal<AppError | null>(null);

  // Raw text as typed, plus the debounce bookkeeping that turns it into
  // searches. `queryPending` is only ever set next to the timer that clears
  // it, so it cannot be left stuck on.
  const [query, setQuery] = createSignal("");
  const [queryPending, setQueryPending] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelDebounce(): void {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
    setQueryPending(false);
  }

  onCleanup(cancelDebounce);

  async function loadEntries(): Promise<void> {
    setIsLoading(true);
    try {
      const result = await invoke<HistoryMeta[]>("history_list", {
        filter: { ...filter(), limit: filter().limit ?? DEFAULT_LIMIT },
      });
      setEntries(result);
    } catch (e) {
      setError(parseError(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function searchEntries(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchQuery("");
      setIsSearching(false);
      await loadEntries();
      return;
    }

    setSearchQuery(trimmed);
    setIsSearching(true);
    setIsLoading(true);
    const isStale = () => searchQuery() !== trimmed;
    try {
      const currentFilter = filter();
      const params: HistorySearchParams = {
        query: trimmed,
        ...(currentFilter.dateFrom ? { dateFrom: currentFilter.dateFrom } : {}),
        ...(currentFilter.dateTo ? { dateTo: currentFilter.dateTo } : {}),
        limit: currentFilter.limit ?? DEFAULT_LIMIT,
        ...(currentFilter.sortBy ? { sortBy: currentFilter.sortBy } : {}),
        ...(currentFilter.sortOrder
          ? { sortOrder: currentFilter.sortOrder }
          : {}),
      };
      const result = await invoke<HistoryMeta[]>("history_search", { params });
      // Discard stale results if query changed while awaiting
      if (!isStale()) {
        setEntries(result);
      }
    } catch (e) {
      if (!isStale()) {
        setError(parseError(e));
      }
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }

  function clearSearch(): void {
    setSearchQuery("");
    setIsSearching(false);
  }

  async function saveEntry(params: HistorySaveParams): Promise<string | null> {
    try {
      const id = await invoke<string>("history_save", { params });
      return id;
    } catch (e) {
      setError(parseError(e));
      return null;
    }
  }

  async function getEntry(id: string): Promise<void> {
    try {
      const entry = await invoke<HistoryEntry>("history_get", { id });
      setSelectedEntry(entry);
    } catch (e) {
      setError(parseError(e));
    }
  }

  async function deleteEntries(ids: string[]): Promise<void> {
    try {
      await invoke("history_delete", { ids });
      setSelectedIds(new Set<string>());
      if (isSearching()) {
        await searchEntries(searchQuery());
      } else {
        await loadEntries();
      }
    } catch (e) {
      setError(parseError(e));
    }
  }

  async function deleteAllEntries(): Promise<boolean> {
    try {
      await invoke("history_delete_all");
      setSelectedIds(new Set<string>());
      await loadEntries();
      return true;
    } catch (e) {
      setError(parseError(e));
      return false;
    }
  }

  async function renameEntry(id: string, fileName: string): Promise<void> {
    try {
      await invoke("history_rename", { id, fileName });
      // Update selectedEntry if it matches
      const current = selectedEntry();
      if (current && current.id === id) {
        setSelectedEntry({ ...current, fileName });
      }
      // Update entries list
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, fileName } : e)),
      );
    } catch (e) {
      setError(parseError(e));
    }
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll(): void {
    setSelectedIds(new Set(entries().map((e) => e.id)));
  }

  function clearSelection(): void {
    setSelectedIds(new Set<string>());
  }

  // Empty → back to all entries. >= MIN → search. In between → hold the list
  // without fetching, so a half-typed word doesn't churn the DB.
  async function runQuery(): Promise<void> {
    const trimmed = query().trim();
    if (!trimmed) {
      clearSearch();
      await loadEntries();
    } else if (trimmed.length >= SEARCH_MIN_LENGTH) {
      await searchEntries(trimmed);
    }
  }

  function updateQuery(value: string): void {
    setQuery(value);
    cancelDebounce();

    const trimmed = value.trim();
    if (!trimmed) {
      void runQuery();
      return;
    }
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      if (isSearching()) clearSearch();
      return;
    }
    // Keep showing the previous results while a search is already on screen.
    if (!isSearching()) setQueryPending(true);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void runQuery().finally(() => setQueryPending(false));
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearQuery(): void {
    setQuery("");
    cancelDebounce();
    void runQuery();
  }

  async function updateFilter(newFilter: HistoryFilter): Promise<void> {
    cancelDebounce();
    setFilter(newFilter);
    const trimmed = query().trim();
    if (trimmed && trimmed.length < SEARCH_MIN_LENGTH) return;
    if (trimmed) setQueryPending(true);
    try {
      await runQuery();
    } finally {
      setQueryPending(false);
    }
  }

  /** True while the typed query is too short for the list to mean anything. */
  function isQueryTooShort(): boolean {
    const len = query().trim().length;
    return len > 0 && len < SEARCH_MIN_LENGTH;
  }

  function clearError(): void {
    setError(null);
  }

  function clearSelectedEntry(): void {
    setSelectedEntry(null);
  }

  return {
    // State (Accessors)
    entries,
    selectedEntry,
    selectedIds,
    filter,
    searchQuery,
    isLoading,
    isSearching,
    queryPending,
    isQueryTooShort,
    error,

    // Actions
    loadEntries,
    searchEntries,
    clearSearch,
    updateQuery,
    clearQuery,
    saveEntry,
    getEntry,
    deleteEntries,
    deleteAllEntries,
    renameEntry,
    toggleSelect,
    selectAll,
    clearSelection,
    updateFilter,
    clearError,
    clearSelectedEntry,
  };
}
