import { MemoryRouter, Route } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "../Dashboard";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

function renderWithRouter() {
  return render(() => (
    <MemoryRouter>
      <Route path="/" component={Dashboard} />
    </MemoryRouter>
  ));
}

describe("Dashboard", () => {
  it("shows Dashboard title", () => {
    renderWithRouter();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows Quick Actions section", () => {
    renderWithRouter();
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it("shows Recent History section with empty state", () => {
    renderWithRouter();
    expect(screen.getByText("Recent History")).toBeInTheDocument();
    expect(screen.getByText(/no transcription history/i)).toBeInTheDocument();
  });

  it("shows Model Status section", () => {
    renderWithRouter();
    expect(screen.getByText("Model Status")).toBeInTheDocument();
  });
});
