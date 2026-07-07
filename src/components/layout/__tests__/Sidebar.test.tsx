import { MemoryRouter, Route } from "@solidjs/router";
import { screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "~/components/ui/sidebar";
import { ja } from "~/i18n/dictionaries/ja";
import { renderWithI18n } from "~/test/helpers";
import { AppSidebar } from "../AppSidebar";

function renderWithRouter() {
  return renderWithI18n(() => (
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
    expect(screen.getByText(ja.nav.dashboard)).toBeInTheDocument();
  });

  it("shows Transcription menu item", () => {
    renderWithRouter();
    expect(screen.getByText(ja.nav.transcription)).toBeInTheDocument();
  });

  it("shows Settings menu item", () => {
    renderWithRouter();
    expect(screen.getByText(ja.nav.settings)).toBeInTheDocument();
  });

  it("shows Dev menu item in DEV mode", () => {
    renderWithRouter();
    // import.meta.env.DEV is true in test environment
    expect(screen.getByText(ja.nav.dev)).toBeInTheDocument();
  });

  it("shows toggle sidebar button", () => {
    renderWithRouter();
    expect(
      screen.getByRole("button", { name: ja.nav.toggleSidebar }),
    ).toBeInTheDocument();
  });
});
