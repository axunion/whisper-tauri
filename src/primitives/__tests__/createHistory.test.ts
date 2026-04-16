import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type {
  HistoryEntry,
  HistoryFilter,
  HistoryMeta,
  HistorySaveParams,
} from "../../types";
import { createHistory } from "../createHistory";

const mockMeta = (overrides?: Partial<HistoryMeta>): HistoryMeta => ({
  id: "entry-1",
  createdAt: "2026-02-20T10:00:00",
  fileName: "audio.wav",
  language: "ja",
  modelId: "large-v3",
  duration: 60000,
  textPreview: "This is a test transcription...",
  ...overrides,
});

const mockEntry: HistoryEntry = {
  id: "entry-1",
  createdAt: "2026-02-20T10:00:00",
  fileName: "audio.wav",
  language: "ja",
  modelId: "large-v3",
  duration: 60000,
  text: "This is a test transcription.",
  segments: [
    { start: 0, end: 3000, text: "This is a test" },
    { start: 3000, end: 5000, text: "transcription." },
  ],
};

const mockSaveParams: HistorySaveParams = {
  fileName: "audio.wav",
  language: "ja",
  modelId: "large-v3",
  duration: 60000,
  text: "This is a test transcription.",
  segments: [
    { start: 0, end: 3000, text: "This is a test" },
    { start: 3000, end: 5000, text: "transcription." },
  ],
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
          filter: { limit: 200 },
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

  describe("saveEntry", () => {
    it("should invoke history_save and return id", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("new-entry-id");

      await createRoot(async (dispose) => {
        const history = createHistory();
        const id = await history.saveEntry(mockSaveParams);

        expect(invoke).toHaveBeenCalledWith("history_save", {
          params: mockSaveParams,
        });
        expect(id).toBe("new-entry-id");
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Database error: disk full"),
      );

      await createRoot(async (dispose) => {
        const history = createHistory();
        const id = await history.saveEntry(mockSaveParams);

        expect(id).toBeNull();
        expect(history.error()).toEqual(
          expect.objectContaining({
            details: "Database error: disk full",
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
    it("should invoke history_delete and reload", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(2) // history_delete
        .mockResolvedValueOnce([]); // history_list

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.deleteEntries(["entry-1", "entry-2"]);

        expect(invoke).toHaveBeenCalledWith("history_delete", {
          ids: ["entry-1", "entry-2"],
        });
        dispose();
      });
    });

    it("should clear selection after delete", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(1).mockResolvedValueOnce([]);

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
          params: { query: "会議", limit: 200 },
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
            limit: 200,
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
          filter: { limit: 200 },
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

  describe("deleteEntries during search", () => {
    it("should re-search after delete when in search mode", async () => {
      const searchResults = [
        mockMeta({ id: "result-1" }),
        mockMeta({ id: "result-2" }),
      ];
      vi.mocked(invoke)
        .mockResolvedValueOnce(searchResults) // initial search
        .mockResolvedValueOnce(1) // delete
        .mockResolvedValueOnce([mockMeta({ id: "result-2" })]); // re-search

      await createRoot(async (dispose) => {
        const history = createHistory();
        await history.searchEntries("テスト");
        expect(history.isSearching()).toBe(true);

        await history.deleteEntries(["result-1"]);

        // Should re-search, not reload
        expect(invoke).toHaveBeenLastCalledWith("history_search", {
          params: { query: "テスト", limit: 200 },
        });
        dispose();
      });
    });
  });
});
