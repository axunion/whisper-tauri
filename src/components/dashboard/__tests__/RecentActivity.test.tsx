import { MemoryRouter, Route, useLocation } from "@solidjs/router";
import { fireEvent, screen } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "~/test/helpers";
import type { HistoryMeta } from "~/types";
import { RecentActivity } from "../RecentActivity";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

function entry(id: string, fileName: string): HistoryMeta {
  return {
    id,
    createdAt: "2026-11-15T10:00:00Z",
    fileName,
    language: "ja",
    modelId: "base",
    duration: 60_000,
    textPreview: `preview of ${fileName}`,
  } as HistoryMeta;
}

/** Shows the route the app landed on and the state it carried. */
function Landed() {
  const location = useLocation();
  return (
    <p data-testid="landed">
      {location.pathname} {JSON.stringify(location.state ?? null)}
    </p>
  );
}

describe("RecentActivity", () => {
  it("navigates to history with the clicked entry's id", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) =>
      cmd === "history_list"
        ? [entry("a-1", "first.wav"), entry("b-2", "second.wav")]
        : [],
    );

    renderWithI18n(() => (
      <MemoryRouter>
        <Route path="/" component={RecentActivity} />
        <Route path="/history" component={() => <Landed />} />
      </MemoryRouter>
    ));

    fireEvent.click(await screen.findByText("second.wav"));

    const landed = await screen.findByTestId("landed");
    expect(landed.textContent).toContain("/history");
    expect(landed.textContent).toContain('"entryId":"b-2"');
  });
});
