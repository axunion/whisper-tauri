import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryEntry, HistoryFilter, HistoryMeta } from "../../types";
import { createHistory } from "../createHistory";

const mockMeta = (overrides?: Partial<HistoryMeta>): HistoryMeta => ({
  id: "entry-1",
  createdAt: "2026-02-20T10:00:00",
  fileName: "audio.wav",
  language: "ja",
  modelId: "large-v3-turbo",
  duration: 60000,
  textPreview: "This is a test transcription...",
  vadEnabled: true,
  source: "file",
  ...overrides,
});

const mockEntry: HistoryEntry = {
  id: "entry-1",
  createdAt: "2026-02-20T10:00:00",
  fileName: "audio.wav",
  language: "ja",
  modelId: "large-v3-turbo",
  duration: 60000,
  text: "This is a test transcription.",
  segments: [
    { start: 0, end: 3000, text: "This is a test" },
    { start: 3000, end: 5000, text: "transcription." },
  ],
  vadEnabled: true,
};

describe("createHistory", () => {
  describe("initial state", () => {
    it("should have empty entries array", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.entries()).toEqual([]);
        dispose();
      });
    });

    it("should have null selectedEntry", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.selectedEntry()).toBeNull();
        dispose();
      });
    });

    it("should have empty selectedIds set", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.selectedIds().size).toBe(0);
        dispose();
      });
    });

    it("should have default filter", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.filter()).toEqual({});
        dispose();
      });
    });

    it("should have isLoading as false", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.isLoading()).toBe(false);
        dispose();
      });
    });

    it("should have null error", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.error()).toBeNull();
        dispose();
      });
    });

    it("should have empty searchQuery", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.searchQuery()).toBe("");
        dispose();
      });
    });

    it("should have isSearching as false", () => {
      createRoot((dispose) => {
        const history = createHistory();
        expect(history.isSearching()).toBe(false);
        dispose();
      });
    });
  });

  describe("loadEntries", () => {
    it("should invoke history_list with current filter", async () => {
      const entries = [mockMeta()];
      vi.mocked(invoke).mockResolvedValueOnce(entries);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.loadEntries();

        expect(invoke).toHaveBeenCalledWith("history_list", {
          filter: { limit: 50 },
        });
        expect(history.entries()).toEqual(entries);
        dispose();
      });
    });

    it("should manage isLoading flag", async () => {
      let resolveList: (value: HistoryMeta[]) => void = () => {};
      const listPromise = new Promise<HistoryMeta[]>((resolve) => {
        resolveList = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(listPromise as Promise<unknown>);

      await createRoot(async (dispose) => {
        const history = createHistory();
        expect(history.isLoading()).toBe(false);

        const promise = history.loadEntries();
        expect(history.isLoading()).toBe(true);

        resolveList([]);
        await promise;
        expect(history.isLoading()).toBe(false);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Database error: table locked"),
      );

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.loadEntries();

        expect(history.error()).toEqual(
          expect.objectContaining({
            details: "Database error: table locked",
          }),
        );
        dispose();
      });
    });
  });

  describe("getEntry", () => {
    it("should invoke history_get and set selectedEntry", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockEntry);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.getEntry("entry-1");

        expect(invoke).toHaveBeenCalledWith("history_get", { id: "entry-1" });
        expect(history.selectedEntry()).toEqual(mockEntry);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce("History not found: entry-999");

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.getEntry("entry-999");

        expect(history.error()).toEqual(
          expect.objectContaining({
            details: "History not found: entry-999",
          }),
        );
        dispose();
      });
    });
  });

  describe("deleteEntries", () => {
    it("should invoke history_delete and drop the entries without reloading", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce([
          mockMeta({ id: "entry-1" }),
          mockMeta({ id: "entry-2" }),
          mockMeta({ id: "entry-3" }),
        ]);
        await history.loadEntries();

        vi.mocked(invoke).mockClear();
        vi.mocked(invoke).mockResolvedValueOnce(2);
        await history.deleteEntries(["entry-1", "entry-2"]);

        expect(vi.mocked(invoke).mock.calls).toEqual([
          ["history_delete", { ids: ["entry-1", "entry-2"] }],
        ]);
        expect(history.entries().map((e) => e.id)).toEqual(["entry-3"]);
        dispose();
      });
    });

    it("should clear selection after delete", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(1);

      await createRoot(async (dispose) => {
        const history = createHistory();
        history.toggleSelect("entry-1");
        expect(history.selectedIds().size).toBe(1);

        await history.deleteEntries(["entry-1"]);
        expect(history.selectedIds().size).toBe(0);
        dispose();
      });
    });
  });

  describe("deleteEntries failure", () => {
    it("should report failure and keep the selection", async () => {
      vi.mocked(invoke).mockRejectedValueOnce("Database error: locked");

      await createRoot(async (dispose) => {
        const history = createHistory();
        history.toggleSelect("entry-1");

        await expect(history.deleteEntries(["entry-1"])).resolves.toBe(false);

        expect(history.selectedIds().size).toBe(1);
        expect(history.error()).not.toBeNull();
        dispose();
      });
    });
  });

  describe("deleteAllEntries", () => {
    it("should invoke history_delete_all and reload", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(5) // history_delete_all
        .mockResolvedValueOnce([]); // history_list

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.deleteAllEntries();

        expect(invoke).toHaveBeenCalledWith("history_delete_all");
        dispose();
      });
    });
  });

  describe("toggleSelect", () => {
    it("should add id to selection", () => {
      createRoot((dispose) => {
        const history = createHistory();
        history.toggleSelect("entry-1");

        expect(history.selectedIds().has("entry-1")).toBe(true);
        dispose();
      });
    });

    it("should remove id from selection if already selected", () => {
      createRoot((dispose) => {
        const history = createHistory();
        history.toggleSelect("entry-1");
        history.toggleSelect("entry-1");

        expect(history.selectedIds().has("entry-1")).toBe(false);
        dispose();
      });
    });
  });

  describe("selectAll", () => {
    it("should select all entries", async () => {
      const entries = [
        mockMeta({ id: "entry-1" }),
        mockMeta({ id: "entry-2" }),
        mockMeta({ id: "entry-3" }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(entries);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.loadEntries();
        history.selectAll();

        expect(history.selectedIds().size).toBe(3);
        expect(history.selectedIds().has("entry-1")).toBe(true);
        expect(history.selectedIds().has("entry-2")).toBe(true);
        expect(history.selectedIds().has("entry-3")).toBe(true);
        dispose();
      });
    });
  });

  describe("clearSelection", () => {
    it("should clear all selected ids", () => {
      createRoot((dispose) => {
        const history = createHistory();
        history.toggleSelect("entry-1");
        history.toggleSelect("entry-2");
        expect(history.selectedIds().size).toBe(2);

        history.clearSelection();
        expect(history.selectedIds().size).toBe(0);
        dispose();
      });
    });
  });

  describe("updateFilter", () => {
    it("should update filter values", () => {
      createRoot((dispose) => {
        const history = createHistory();
        const newFilter: HistoryFilter = {
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
        };
        history.updateFilter(newFilter);

        expect(history.filter()).toEqual(newFilter);
        dispose();
      });
    });
  });

  describe("clearError", () => {
    it("should set error to null", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Some error"));

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.loadEntries();
        expect(history.error()).not.toBeNull();

        history.clearError();
        expect(history.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("clearSelectedEntry", () => {
    it("should set selectedEntry to null", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockEntry);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.getEntry("entry-1");
        expect(history.selectedEntry()).not.toBeNull();

        history.clearSelectedEntry();
        expect(history.selectedEntry()).toBeNull();
        dispose();
      });
    });
  });

  describe("searchEntries", () => {
    it("should invoke history_search with query and set results", async () => {
      const results = [mockMeta({ id: "search-result" })];
      vi.mocked(invoke).mockResolvedValueOnce(results);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.searchEntries("会議");

        expect(invoke).toHaveBeenCalledWith("history_search", {
          params: { query: "会議", limit: 50 },
        });
        expect(history.entries()).toEqual(results);
        expect(history.searchQuery()).toBe("会議");
        expect(history.isSearching()).toBe(true);
        dispose();
      });
    });

    it("should include date filter in search params", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await createRoot(async (dispose) => {
        const history = createHistory();
        history.updateFilter({
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
        });
        await history.searchEntries("テスト");

        expect(invoke).toHaveBeenCalledWith("history_search", {
          params: {
            query: "テスト",
            dateFrom: "2026-01-01",
            dateTo: "2026-12-31",
            limit: 50,
          },
        });
        dispose();
      });
    });

    it("should fallback to loadEntries for empty query", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([mockMeta()]);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.searchEntries("   ");

        expect(invoke).toHaveBeenCalledWith("history_list", {
          filter: { limit: 50 },
        });
        expect(history.searchQuery()).toBe("");
        expect(history.isSearching()).toBe(false);
        dispose();
      });
    });

    it("should set isSearching flag", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await createRoot(async (dispose) => {
        const history = createHistory();
        expect(history.isSearching()).toBe(false);

        await history.searchEntries("検索");
        expect(history.isSearching()).toBe(true);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Database error: search failed"),
      );

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.searchEntries("エラー");

        expect(history.error()).toEqual(
          expect.objectContaining({
            details: "Database error: search failed",
          }),
        );
        dispose();
      });
    });
  });

  describe("clearSearch", () => {
    it("should reset searchQuery and isSearching", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([]);

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.searchEntries("テスト");
        expect(history.isSearching()).toBe(true);

        history.clearSearch();
        expect(history.searchQuery()).toBe("");
        expect(history.isSearching()).toBe(false);
        dispose();
      });
    });
  });

  describe("updateQuery", () => {
    it("should search for a two-character query", async () => {
      vi.useFakeTimers();
      vi.mocked(invoke).mockClear();
      vi.mocked(invoke).mockResolvedValue([mockMeta({ id: "hit" })]);

      try {
        await createRoot(async (dispose) => {
          const history = createHistory();
          history.updateQuery("会議");
          await vi.advanceTimersByTimeAsync(400);

          expect(invoke).toHaveBeenCalledWith("history_search", {
            params: { query: "会議", limit: 50 },
          });
          expect(history.entries().map((e) => e.id)).toEqual(["hit"]);
          dispose();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("should debounce into a single search and clear the pending flag", async () => {
      vi.useFakeTimers();
      vi.mocked(invoke).mockClear();
      vi.mocked(invoke).mockResolvedValue([mockMeta({ id: "hit" })]);

      try {
        await createRoot(async (dispose) => {
          const history = createHistory();
          history.updateQuery("会議");
          history.updateQuery("会議録");

          expect(history.queryPending()).toBe(true);
          expect(invoke).not.toHaveBeenCalled();

          await vi.advanceTimersByTimeAsync(400);

          expect(vi.mocked(invoke).mock.calls).toHaveLength(1);
          expect(invoke).toHaveBeenCalledWith("history_search", {
            params: { query: "会議録", limit: 50 },
          });
          expect(history.queryPending()).toBe(false);
          dispose();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("should reset to all entries and drop the pending flag when emptied", async () => {
      vi.useFakeTimers();
      vi.mocked(invoke).mockClear();
      vi.mocked(invoke).mockResolvedValue([]);

      try {
        await createRoot(async (dispose) => {
          const history = createHistory();
          history.updateQuery("会議録");
          expect(history.queryPending()).toBe(true);

          history.updateQuery("");

          // Clearing cancels the debounce outright — no stuck pending flag.
          expect(history.queryPending()).toBe(false);
          await vi.advanceTimersByTimeAsync(400);

          expect(invoke).toHaveBeenCalledWith("history_list", {
            filter: { limit: 50 },
          });
          expect(history.isSearching()).toBe(false);
          dispose();
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("paging", () => {
    const page = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) =>
        mockMeta({ id: `${prefix}-${i}` }),
      );

    it("should report more entries only when a full page came back", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        expect(history.hasLoaded()).toBe(false);

        vi.mocked(invoke).mockResolvedValue(page("a", 50));
        await history.loadEntries();
        expect(history.hasLoaded()).toBe(true);
        expect(history.hasMore()).toBe(true);

        vi.mocked(invoke).mockResolvedValue(page("b", 49));
        await history.loadEntries();
        expect(history.hasMore()).toBe(false);
        dispose();
      });
    });

    it("should append the next page at the current offset", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValue(page("a", 50));
        await history.loadEntries();

        vi.mocked(invoke).mockClear();
        vi.mocked(invoke).mockResolvedValue(page("b", 3));
        await history.loadMore();

        expect(invoke).toHaveBeenCalledWith("history_list", {
          filter: { limit: 50, offset: 50 },
        });
        expect(history.entries()).toHaveLength(53);
        expect(history.entries()[50]?.id).toBe("b-0");
        expect(history.hasMore()).toBe(false);
        dispose();
      });
    });

    it("should page through search results with the query", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValue(page("a", 50));
        await history.searchEntries("会議");

        vi.mocked(invoke).mockClear();
        vi.mocked(invoke).mockResolvedValue([]);
        await history.loadMore();

        expect(invoke).toHaveBeenCalledWith("history_search", {
          params: { query: "会議", limit: 50, offset: 50 },
        });
        expect(history.entries()).toHaveLength(50);
        dispose();
      });
    });

    it("should not fetch when there is nothing more to load", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValue(page("a", 10));
        await history.loadEntries();

        vi.mocked(invoke).mockClear();
        await history.loadMore();

        expect(invoke).not.toHaveBeenCalled();
        dispose();
      });
    });

    it("should drop a page that arrives after the view was reloaded", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValue(page("a", 50));
        await history.loadEntries();

        let resolveStale: (value: HistoryMeta[]) => void = () => {};
        vi.mocked(invoke).mockReturnValueOnce(
          new Promise<HistoryMeta[]>((resolve) => {
            resolveStale = resolve;
          }),
        );
        const stale = history.loadMore();

        vi.mocked(invoke).mockResolvedValue(page("fresh", 2));
        await history.searchEntries("会議");
        resolveStale(page("stale", 50));
        await stale;

        expect(history.entries().map((e) => e.id)).toEqual([
          "fresh-0",
          "fresh-1",
        ]);
        expect(history.isLoading()).toBe(false);
        dispose();
      });
    });
  });

  describe("paging edge cases", () => {
    const page = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) =>
        mockMeta({ id: `${prefix}-${i}` }),
      );

    beforeEach(() => {
      vi.mocked(invoke).mockReset();
    });

    it("should clear isLoading when a superseded first page is dropped", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        let resolveStale: (value: HistoryMeta[]) => void = () => {};
        vi.mocked(invoke).mockReturnValueOnce(
          new Promise<HistoryMeta[]>((resolve) => {
            resolveStale = resolve;
          }),
        );
        const stale = history.loadEntries();
        expect(history.isLoading()).toBe(true);

        vi.mocked(invoke).mockResolvedValueOnce(page("fresh", 2));
        await history.searchEntries("会議");
        expect(history.isLoading()).toBe(false);

        resolveStale(page("stale", 50));
        await stale;
        expect(history.isLoading()).toBe(false);
        expect(history.entries().map((e) => e.id)).toEqual([
          "fresh-0",
          "fresh-1",
        ]);
        expect(history.isLoading()).toBe(false);
        dispose();
      });
    });

    it("should report a loadMore failure and keep the loaded entries", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 50));
        await history.loadEntries();

        vi.mocked(invoke).mockRejectedValueOnce(
          new Error("Database error: locked"),
        );
        await history.loadMore();

        expect(history.error()).toEqual(
          expect.objectContaining({ details: "Database error: locked" }),
        );
        expect(history.entries()).toHaveLength(50);
        expect(history.isLoading()).toBe(false);
        expect(history.hasMore()).toBe(true);
        dispose();
      });
    });

    it("should ignore loadMore while another load is in flight", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 50));
        await history.loadEntries();
        vi.mocked(invoke).mockClear();

        let resolveMore: (value: HistoryMeta[]) => void = () => {};
        vi.mocked(invoke).mockReturnValueOnce(
          new Promise<HistoryMeta[]>((resolve) => {
            resolveMore = resolve;
          }),
        );
        const first = history.loadMore();
        const second = history.loadMore();
        expect(invoke).toHaveBeenCalledTimes(1);

        resolveMore(page("b", 3));
        await Promise.all([first, second]);
        expect(history.entries()).toHaveLength(53);
        dispose();
      });
    });

    it("should restart from the first page when the filter changes", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 50));
        await history.loadEntries();
        vi.mocked(invoke).mockResolvedValueOnce(page("b", 3));
        await history.loadMore();
        expect(history.entries()).toHaveLength(53);

        vi.mocked(invoke).mockClear();
        vi.mocked(invoke).mockResolvedValueOnce(page("c", 2));
        await history.updateFilter({ sortBy: "duration" });

        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith("history_list", {
          filter: { limit: 50, sortBy: "duration" },
        });
        expect(history.entries().map((e) => e.id)).toEqual(["c-0", "c-1"]);
        expect(history.hasMore()).toBe(false);
        dispose();
      });
    });

    it("should use a custom filter limit as the page size", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 7));
        await history.updateFilter({ limit: 7 });
        expect(history.hasMore()).toBe(true);

        vi.mocked(invoke).mockResolvedValueOnce(page("b", 6));
        await history.loadMore();

        expect(invoke).toHaveBeenLastCalledWith("history_list", {
          filter: { limit: 7, offset: 7 },
        });
        expect(history.entries()).toHaveLength(13);
        expect(history.hasMore()).toBe(false);
        dispose();
      });
    });

    it("should not report more entries when a custom limit is not filled", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 6));
        await history.updateFilter({ limit: 7 });
        expect(history.hasMore()).toBe(false);
        dispose();
      });
    });
  });

  describe("deleteEntries during search", () => {
    it("should keep the remaining search results after a delete", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce([
          mockMeta({ id: "result-1" }),
          mockMeta({ id: "result-2" }),
        ]) // search
        .mockResolvedValueOnce(1); // delete

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.searchEntries("テスト");

        await history.deleteEntries(["result-1"]);

        expect(history.isSearching()).toBe(true);
        expect(history.entries().map((e) => e.id)).toEqual(["result-2"]);
        dispose();
      });
    });
  });

  describe("paging consistency", () => {
    const page = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) =>
        mockMeta({ id: `${prefix}-${i}` }),
      );

    it("should not repeat an entry that a later page returns again", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 50));
        await history.loadEntries();

        vi.mocked(invoke).mockResolvedValueOnce([
          mockMeta({ id: "a-49" }),
          mockMeta({ id: "b-0" }),
        ]);
        await history.loadMore();

        const ids = history.entries().map((e) => e.id);
        expect(ids).toHaveLength(51);
        expect(new Set(ids).size).toBe(51);
        dispose();
      });
    });

    it("should stop offering more entries when a first page fails to load", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 50));
        await history.loadEntries();
        expect(history.hasMore()).toBe(true);

        vi.mocked(invoke).mockRejectedValueOnce("Database error: boom");
        await history.updateFilter({ sortBy: "duration" });

        expect(history.error()).not.toBeNull();
        expect(history.hasMore()).toBe(false);
        expect(history.isLoading()).toBe(false);
        dispose();
      });
    });

    it("should reload after a rename when the list is sorted by name", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 2));
        await history.updateFilter({ sortBy: "fileName" });

        vi.mocked(invoke).mockClear();
        vi.mocked(invoke)
          .mockResolvedValueOnce(undefined) // rename
          .mockResolvedValueOnce(page("b", 2)); // reload
        await history.renameEntry("a-0", "zzz");

        expect(invoke).toHaveBeenLastCalledWith("history_list", {
          filter: { limit: 50, sortBy: "fileName" },
        });
        expect(history.entries().map((e) => e.id)).toEqual(["b-0", "b-1"]);
        dispose();
      });
    });

    it("should not reload after a rename in the default date order", async () => {
      await createRoot(async (dispose) => {
        const history = createHistory();
        vi.mocked(invoke).mockResolvedValueOnce(page("a", 2));
        await history.loadEntries();

        vi.mocked(invoke).mockClear();
        vi.mocked(invoke).mockResolvedValueOnce(undefined);
        await history.renameEntry("a-0", "zzz");

        expect(vi.mocked(invoke).mock.calls).toHaveLength(1);
        expect(history.entries()[0]?.fileName).toBe("zzz");
        dispose();
      });
    });
  });
});
