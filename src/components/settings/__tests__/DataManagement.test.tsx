import { screen, waitFor } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "~/i18n/dictionaries/en";
import { renderWithI18n } from "~/test/helpers";
import type { StorageStats } from "~/types";
import DataManagement from "../DataManagement";

const stats = (overrides?: Partial<StorageStats>): StorageStats => ({
  audioCount: 2,
  audioBytes: 2048,
  pendingRecordingCount: 0,
  pendingRecordingBytes: 0,
  ...overrides,
});

function mockStats(value: StorageStats) {
  vi.mocked(invoke).mockImplementation(async (command: string) =>
    command === "history_storage_stats" ? value : undefined,
  );
}

/** The first "Delete" button belongs to the audio row, which is rendered first. */
function audioDeleteButton(): HTMLButtonElement {
  return screen.getAllByRole("button", {
    name: en.common.delete,
  })[0] as HTMLButtonElement;
}

describe("DataManagement", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("renders the audio usage from the storage stats", async () => {
    mockStats(stats({ audioCount: 2, audioBytes: 2048 }));

    renderWithI18n(() => <DataManagement />, "en");

    expect(await screen.findByText("2 · 2.0 KB")).toBeInTheDocument();
  });

  it("hides the pending-recordings row when there are none", async () => {
    mockStats(stats({ pendingRecordingCount: 0 }));

    renderWithI18n(() => <DataManagement />, "en");
    await screen.findByText("2 · 2.0 KB");

    expect(
      screen.queryByText(en.settings.pendingRecordings),
    ).not.toBeInTheDocument();
  });

  it("shows the pending-recordings row when there are some", async () => {
    mockStats(stats({ pendingRecordingCount: 3, pendingRecordingBytes: 512 }));

    renderWithI18n(() => <DataManagement />, "en");

    expect(
      await screen.findByText(en.settings.pendingRecordings),
    ).toBeInTheDocument();
    expect(screen.getByText("3 · 512 B")).toBeInTheDocument();
  });

  it("disables delete-all-audio when there is no audio", async () => {
    mockStats(
      stats({
        audioCount: 0,
        audioBytes: 0,
        pendingRecordingCount: 1,
        pendingRecordingBytes: 10,
      }),
    );

    renderWithI18n(() => <DataManagement />, "en");
    await screen.findByText(en.settings.pendingRecordings);

    expect(audioDeleteButton()).toBeDisabled();
  });

  it("enables delete-all-audio when there is audio", async () => {
    mockStats(stats({ audioCount: 2 }));

    renderWithI18n(() => <DataManagement />, "en");
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("history_storage_stats", {
        keepPath: null,
      }),
    );
    await screen.findByText("2 · 2.0 KB");

    expect(audioDeleteButton()).toBeEnabled();
  });
});
