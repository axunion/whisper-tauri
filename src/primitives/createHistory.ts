import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { parseError } from "../lib/errors";
import type {
  HistoryEntry,
  HistoryFilter,
  HistoryMeta,
  HistorySaveParams,
  HistorySearchParams,
} from "../types";
import type { AppError } from "../types/errors";

const DEFAULT_LIMIT = 200;

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
    try {
      const currentFilter = filter();
      const params: HistorySearchParams = {
        query: trimmed,
        ...(currentFilter.dateFrom ? { dateFrom: currentFilter.dateFrom } : {}),
        ...(currentFilter.dateTo ? { dateTo: currentFilter.dateTo } : {}),
        limit: currentFilter.limit ?? DEFAULT_LIMIT,
      };
      const result = await invoke<HistoryMeta[]>("history_search", { params });
      // Discard stale results if query changed while awaiting
      if (searchQuery() === trimmed) {
        setEntries(result);
      }
    } catch (e) {
      if (searchQuery() === trimmed) {
        setError(parseError(e));
      }
    } finally {
      if (searchQuery() === trimmed) {
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

  async function deleteAllEntries(): Promise<void> {
    try {
      await invoke("history_delete_all");
      setSelectedIds(new Set<string>());
      await loadEntries();
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

  function updateFilter(newFilter: HistoryFilter): void {
    setFilter(newFilter);
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
    error,

    // Actions
    loadEntries,
    searchEntries,
    clearSearch,
    saveEntry,
    getEntry,
    deleteEntries,
    deleteAllEntries,
    toggleSelect,
    selectAll,
    clearSelection,
    updateFilter,
    clearError,
    clearSelectedEntry,
  };
}
