import { MemoryRouter, Route } from "@solidjs/router";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "~/components/ui/sidebar";
import { I18nProvider } from "~/i18n";
import { ja } from "~/i18n/dictionaries/ja";
import { toast } from "~/lib/toast";
import History from "../History";

// Fakes for the two primitives the guard reads. Only what the page touches is
// modelled; anything else is a no-op so the page still mounts.
const { SOURCE_ID, OTHER_ID, fakes } = vi.hoisted(() => ({
  SOURCE_ID: "source-entry",
  OTHER_ID: "other-entry",
  fakes: {
    setSelection: (_ids: Set<string>) => {},
    deleteEntries: vi.fn(() => Promise.resolve(true)),
  },
}));

vi.mock("~/primitives/createHistory", async () => {
  const { createSignal } = await import("solid-js");
  const value = (v: unknown) => () => v;
  const [selection, setSelection] = createSignal<Set<string>>(new Set());
  fakes.setSelection = setSelection;
  const history: Record<string, unknown> = {
    entries: value([]),
    selectedEntry: value(null),
    detail: value(null),
    error: value(null),
    filter: value({}),
    searchQuery: value(""),
    queryPending: value(false),
    hasLoaded: value(true),
    hasMore: value(false),
    isLoading: value(false),
    isSearching: value(false),
    selectedIds: selection,
    deleteEntries: fakes.deleteEntries,
  };
  return {
    createHistory: () =>
      new Proxy(history, {
        get: (target, key: string) => target[key] ?? vi.fn(),
      }),
  };
});

vi.mock("~/primitives/createTranscriptionJob", () => ({
  createTranscriptionJob: () => ({
    audioSourceId: () => SOURCE_ID,
    isRunning: () => false,
  }),
}));

vi.mock("~/lib/toast", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
  convertFileSrc: vi.fn((path: string) => path),
}));

function renderHistory() {
  return render(() => (
    <I18nProvider locale="ja">
      <SidebarProvider>
        <MemoryRouter>
          <Route path="/" component={History} />
        </MemoryRouter>
      </SidebarProvider>
    </I18nProvider>
  ));
}

/** Enters selection mode, selects the given ids, and presses Delete then confirms. */
async function deleteSelection(ids: string[]) {
  fakes.setSelection(new Set(ids));
  fireEvent.click(screen.getByRole("button", { name: ja.history.select }));
  const [openButton] = await screen.findAllByRole("button", {
    name: ja.common.delete,
  });
  if (!openButton) throw new Error("delete button missing");
  fireEvent.click(openButton);
  const buttons = await screen.findAllByRole("button", {
    name: ja.common.delete,
  });
  const confirm = buttons[buttons.length - 1];
  if (!confirm) throw new Error("confirm button missing");
  fireEvent.click(confirm);
}

describe("History selection delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the selection when it does not include the audio in use", async () => {
    renderHistory();
    await deleteSelection([OTHER_ID]);

    await vi.waitFor(() =>
      expect(fakes.deleteEntries).toHaveBeenCalledWith([OTHER_ID]),
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("refuses and shows an info toast when the selection includes the audio in use", async () => {
    renderHistory();
    await deleteSelection([OTHER_ID, SOURCE_ID]);

    await vi.waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(ja.history.inUseByTranscription),
    );
    expect(fakes.deleteEntries).not.toHaveBeenCalled();
  });
});
