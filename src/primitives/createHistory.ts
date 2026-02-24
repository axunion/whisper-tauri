import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { parseError } from "../lib/errors";
import type {
  HistoryEntry,
  HistoryFilter,
  HistoryMeta,
  HistorySaveParams,
} from "../types";
import type { AppError } from "../types/errors";

export function createHistory() {
  const [entries, setEntries] = createSignal<HistoryMeta[]>([]);
  const [selectedEntry, setSelectedEntry] = createSignal<HistoryEntry | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(
    new Set<string>(),
  );
  const [filter, setFilter] = createSignal<HistoryFilter>({});
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<AppError | null>(null);

  async function loadEntries(): Promise<void> {
    setIsLoading(true);
    try {
      const result = await invoke<HistoryMeta[]>("history_list", {
        filter: filter(),
      });
      setEntries(result);
    } catch (e) {
      setError(parseError(e));
    } finally {
      setIsLoading(false);
    }
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
      await loadEntries();
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
    isLoading,
    error,

    // Actions
    loadEntries,
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
