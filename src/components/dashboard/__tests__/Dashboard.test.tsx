import { MemoryRouter, Route } from "@solidjs/router";
import { screen } from "@solidjs/testing-library";
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
  it("shows Dashboard title", () => {
    renderWithRouter();
    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
  });

  it("shows Quick Actions section", () => {
    renderWithRouter();
    expect(screen.getByText("クイックアクション")).toBeInTheDocument();
  });

  it("shows Recent History section with empty state", () => {
    renderWithRouter();
    expect(screen.getByText("最近の履歴")).toBeInTheDocument();
    expect(
      screen.getByText(/文字起こし履歴はまだありません/),
    ).toBeInTheDocument();
  });

  it("shows Model Status section", () => {
    renderWithRouter();
    expect(screen.getByText("モデル状態")).toBeInTheDocument();
  });
});
