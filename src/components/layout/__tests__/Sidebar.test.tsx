import { MemoryRouter, Route } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "../AppSidebar";

function renderWithRouter() {
  return render(() => (
    <MemoryRouter>
      <Route
        path="/"
        component={() => (
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        )}
      />
    </MemoryRouter>
  ));
}

describe("AppSidebar", () => {
  it("renders the sidebar", () => {
    renderWithRouter();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("shows Dashboard menu item", () => {
    renderWithRouter();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows Transcription menu item", () => {
    renderWithRouter();
    expect(screen.getByText("Transcription")).toBeInTheDocument();
  });

  it("shows Settings menu item", () => {
    renderWithRouter();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows Dev menu item in DEV mode", () => {
    renderWithRouter();
    // import.meta.env.DEV is true in test environment
    expect(screen.getByText("Dev")).toBeInTheDocument();
  });

  it("shows toggle sidebar button", () => {
    renderWithRouter();
    expect(
      screen.getByRole("button", { name: /toggle sidebar/i }),
    ).toBeInTheDocument();
  });
});
