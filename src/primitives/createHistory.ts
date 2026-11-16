import { invoke } from "@tauri-apps/api/core";
import { createSignal, onCleanup } from "solid-js";
import { parseError } from "~/lib/errors";
import type {
  HistoryEntry,
  HistoryFilter,
  HistoryMeta,
  HistorySearchParams,
  SegmentUpdate,
} from "~/types";
import type { AppError } from "~/types/errors";

/** Entries fetched per page; "load more" appends the next page. */
const PAGE_SIZE = 50;

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
  // False until the first fetch settles, so a view can tell "nothing yet" from
  // "no entries".
  const [hasLoaded, setHasLoaded] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(false);
  const [error, setError] = createSignal<AppError | null>(null);

  // Raw text as typed, plus the debounce bookkeeping that turns it into
  // searches. `queryPending` is only ever set next to the timer that clears
  // it, so it cannot be left stuck on.
  const [query, setQuery] = createSignal("");
  const [queryPending, setQueryPending] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Bumped by every fetch of a first page. A response belongs on screen only
  // if no newer first-page fetch (a new query, filter or reload) started while
  // it was in flight.
  let generation = 0;

  function cancelDebounce(): void {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
    setQueryPending(false);
  }

  onCleanup(cancelDebounce);

  function pageSize(): number {
    return filter().limit ?? PAGE_SIZE;
  }

  /** Fetches one page of the current view: the search if one is active, the list otherwise. */
  function fetchPage(offset: number): Promise<HistoryMeta[]> {
    const { dateFrom, dateTo, sortBy, sortOrder } = filter();
    const common = {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      limit: pageSize(),
      ...(offset > 0 ? { offset } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sortOrder ? { sortOrder } : {}),
    };
    if (isSearching()) {
      const params: HistorySearchParams = { query: searchQuery(), ...common };
      return invoke<HistoryMeta[]>("history_search", { params });
    }
    const listFilter: HistoryFilter = common;
    return invoke<HistoryMeta[]>("history_list", { filter: listFilter });
  }

  async function fetchFirstPage(): Promise<void> {
    const current = ++generation;
    setIsLoading(true);
    try {
      const result = await fetchPage(0);
      if (current !== generation) return;
      setEntries(result);
      setHasMore(result.length === pageSize());
    } catch (e) {
      if (current === generation) {
        setError(parseError(e));
        // The list on screen still belongs to the previous view; paging it
        // would append rows of the view that just failed to load.
        setHasMore(false);
      }
    } finally {
      if (current === generation) {
        setIsLoading(false);
        setHasLoaded(true);
      }
    }
  }

  async function loadEntries(): Promise<void> {
    await fetchFirstPage();
  }

  async function loadMore(): Promise<void> {
    if (isLoading() || !hasMore()) return;
    const current = generation;
    setIsLoading(true);
    try {
      const result = await fetchPage(entries().length);
      if (current !== generation) return;
      // Skip ids already on screen: a save that landed since the first page
      // shifts every offset, which would otherwise repeat a row.
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...result.filter((e) => !seen.has(e.id))];
      });
      setHasMore(result.length === pageSize());
    } catch (e) {
      if (current === generation) setError(parseError(e));
    } finally {
      if (current === generation) setIsLoading(false);
    }
  }

  async function searchEntries(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      clearSearch();
      await loadEntries();
      return;
    }

    setSearchQuery(trimmed);
    setIsSearching(true);
    await fetchFirstPage();
  }

  function clearSearch(): void {
    setSearchQuery("");
    setIsSearching(false);
  }

  async function getEntry(id: string): Promise<void> {
    try {
      const entry = await invoke<HistoryEntry>("history_get", { id });
      setSelectedEntry(entry);
    } catch (e) {
      setError(parseError(e));
    }
  }

  async function deleteEntries(ids: string[]): Promise<boolean> {
    try {
      await invoke("history_delete", { ids });
      setSelectedIds(new Set<string>());
      // Dropped locally instead of reloading, so deleting from a later page
      // keeps the user's place. The database shrinks by the same rows, so the
      // list length stays a valid offset for the next page.
      const deleted = new Set(ids);
      setEntries((prev) => prev.filter((e) => !deleted.has(e.id)));
      return true;
    } catch (e) {
      setError(parseError(e));
      return false;
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
      // A new name can move the entry within a name-sorted list, or in or out
      // of a search (which matches file names), invalidating the page offsets.
      if (filter().sortBy === "fileName" || isSearching()) {
        await fetchFirstPage();
      }
    } catch (e) {
      setError(parseError(e));
    }
  }

  /** Replaces the text of one segment of an entry. */
  async function updateSegment(
    id: string,
    index: number,
    text: string,
  ): Promise<boolean> {
    try {
      const update = await invoke<SegmentUpdate>("history_update_segment", {
        id,
        index,
        text,
      });
      const current = selectedEntry();
      if (current?.id === id) {
        setSelectedEntry({
          ...current,
          text: update.text,
          segments: current.segments.map((segment, i) =>
            i === index ? { ...segment, text: update.segmentText } : segment,
          ),
        });
      }
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, textPreview: update.textPreview } : e,
        ),
      );
      return true;
    } catch (e) {
      setError(parseError(e));
      return false;
    }
  }

  /** Deletes an entry's recording audio, keeping the entry itself. */
  async function deleteAudio(id: string): Promise<boolean> {
    try {
      await invoke("history_delete_audio", { id });
      const current = selectedEntry();
      if (current?.id === id) {
        setSelectedEntry({ ...current, audioPath: null });
      }
      return true;
    } catch (e) {
      setError(parseError(e));
      return false;
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

  // Empty → back to all entries, anything else → search.
  async function runQuery(): Promise<void> {
    const trimmed = query().trim();
    if (!trimmed) {
      clearSearch();
      await loadEntries();
    } else {
      await searchEntries(trimmed);
    }
  }

  function updateQuery(value: string): void {
    setQuery(value);
    cancelDebounce();

    if (!value.trim()) {
      void runQuery();
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
    if (query().trim()) setQueryPending(true);
    try {
      await runQuery();
    } finally {
      setQueryPending(false);
    }
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
    hasLoaded,
    hasMore,
    queryPending,
    error,

    // Actions
    loadEntries,
    loadMore,
    searchEntries,
    clearSearch,
    updateQuery,
    clearQuery,
    getEntry,
    deleteEntries,
    deleteAllEntries,
    renameEntry,
    updateSegment,
    deleteAudio,
    toggleSelect,
    selectAll,
    clearSelection,
    updateFilter,
    clearError,
    clearSelectedEntry,
  };
}
