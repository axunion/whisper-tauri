import { MemoryRouter, Route } from "@solidjs/router";
import { screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "~/test/helpers";
import { Dashboard } from "../Dashboard";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

function renderWithRouter() {
  return renderWithI18n(() => (
    <MemoryRouter>
      <Route path="/" component={Dashboard} />
    </MemoryRouter>
  ));
}

describe("Dashboard", () => {
  it("shows Hero Card with title and CTA", () => {
    renderWithRouter();
    expect(screen.getByText("音声を文字に")).toBeInTheDocument();
    expect(screen.getByText("文字起こしを開始")).toBeInTheDocument();
  });

  it("shows Stats Row labels", async () => {
    renderWithRouter();
    expect(screen.getByText("文字起こし")).toBeInTheDocument();
    expect(screen.getByText("合計時間")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("モデル")).toBeInTheDocument();
      expect(screen.getByText("FFmpeg")).toBeInTheDocument();
      expect(screen.getByText("AI")).toBeInTheDocument();
    });
  });

  it("hides Recent Activity when no history entries", () => {
    renderWithRouter();
    expect(screen.queryByText("最近のアクティビティ")).not.toBeInTheDocument();
  });
});
