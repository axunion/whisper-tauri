import { MemoryRouter, Route } from "@solidjs/router";
import { screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { ja } from "~/i18n/dictionaries/ja";
import { renderWithI18n } from "~/test/helpers";
import { Dashboard } from "../Dashboard";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(() => Promise.resolve(null)),
}));

function renderWithRouter() {
  return renderWithI18n(() => (
    <MemoryRouter>
      <Route path="/" component={Dashboard} />
    </MemoryRouter>
  ));
}

describe("Dashboard", () => {
  it("shows QuickActions cards", () => {
    renderWithRouter();
    expect(screen.getByText(ja.dashboard.quickActionFile)).toBeInTheDocument();
    expect(
      screen.getByText(ja.dashboard.quickActionRecord),
    ).toBeInTheDocument();
  });

  it("hides Recent Activity when no history entries", () => {
    renderWithRouter();
    expect(
      screen.queryByText(ja.dashboard.recentActivity),
    ).not.toBeInTheDocument();
  });
});
