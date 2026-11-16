import { MemoryRouter, Route, useLocation } from "@solidjs/router";
import { fireEvent, screen } from "@solidjs/testing-library";
import { open } from "@tauri-apps/plugin-dialog";
import type { ParentProps } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_SEARCH_ID } from "~/lib/constants";
import { renderWithI18n } from "~/test/helpers";
import { Shortcuts } from "../Shortcuts";

/** Shows where the router is and what state it carried there. */
function Where() {
  const location = useLocation();
  return (
    <p data-testid="where">
      {location.pathname} {JSON.stringify(location.state ?? null)}
    </p>
  );
}

function Layout(props: ParentProps) {
  return (
    <>
      <Shortcuts />
      <Where />
      {props.children}
    </>
  );
}

function renderApp() {
  return renderWithI18n(() => (
    <MemoryRouter root={Layout}>
      <Route path="/" component={() => <div />} />
      <Route path="/settings" component={() => <div />} />
      <Route path="/transcription" component={() => <div />} />
      <Route
        path="/history"
        component={() => <input id={HISTORY_SEARCH_ID} aria-label="search" />}
      />
    </MemoryRouter>
  ));
}

const where = () => screen.getByTestId("where").textContent;

describe("Shortcuts", () => {
  beforeEach(() => {
    vi.mocked(open).mockReset();
  });

  it("opens settings on Ctrl+,", async () => {
    renderApp();

    fireEvent.keyDown(window, { key: ",", ctrlKey: true });

    await vi.waitFor(() => expect(where()).toContain("/settings"));
  });

  it("goes to the history search on Ctrl+F from another page", async () => {
    renderApp();

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });

    await vi.waitFor(() =>
      expect(where()).toBe('/history {"focusSearch":true}'),
    );
  });

  it("focuses the search box on Ctrl+F when already on the history page", async () => {
    renderApp();
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    const search = await screen.findByLabelText("search");
    search.blur();

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });

    expect(search).toHaveFocus();
  });

  it("hands the files picked on Ctrl+O to the transcription page", async () => {
    vi.mocked(open).mockResolvedValue(["/a/one.wav", "/a/two.mp3"]);
    renderApp();

    fireEvent.keyDown(window, { key: "o", ctrlKey: true });

    await vi.waitFor(() =>
      expect(where()).toBe(
        '/transcription {"filePaths":["/a/one.wav","/a/two.mp3"]}',
      ),
    );
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true }),
    );
  });

  it("stays put when the file dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);
    renderApp();

    fireEvent.keyDown(window, { key: "o", ctrlKey: true });
    await vi.waitFor(() => expect(open).toHaveBeenCalled());

    expect(where()).toContain("/ ");
  });

  it("uses Cmd rather than Ctrl on macOS, where Ctrl+F moves the text cursor", async () => {
    const platform = vi
      .spyOn(navigator, "platform", "get")
      .mockReturnValue("MacIntel");
    try {
      renderApp();

      fireEvent.keyDown(window, { key: ",", ctrlKey: true });
      expect(where()).toContain("/ ");

      fireEvent.keyDown(window, { key: ",", metaKey: true });
      await vi.waitFor(() => expect(where()).toContain("/settings"));
    } finally {
      platform.mockRestore();
    }
  });

  it("matches the letter under Caps Lock", async () => {
    renderApp();

    fireEvent.keyDown(window, { key: "F", ctrlKey: true });

    await vi.waitFor(() => expect(where()).toContain("/history"));
  });

  it("ignores the keys without the modifier, or with extra ones", () => {
    renderApp();

    fireEvent.keyDown(window, { key: "," });
    fireEvent.keyDown(window, { key: ",", ctrlKey: true, shiftKey: true });

    expect(where()).toContain("/ ");
  });
});
