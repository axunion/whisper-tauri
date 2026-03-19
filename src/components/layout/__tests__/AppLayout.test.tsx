import { MemoryRouter, Route } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetSettingsForTesting } from "~/primitives/createSettings";
import { AppLayout } from "../AppLayout";

describe("AppLayout", () => {
  beforeEach(() => {
    _resetSettingsForTesting({ onboardingCompleted: true, loaded: true });
  });

  it("renders the layout", () => {
    render(() => (
      <MemoryRouter root={AppLayout}>
        <Route path="/" component={() => <div>Test Content</div>} />
      </MemoryRouter>
    ));
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("contains navigation element", () => {
    render(() => (
      <MemoryRouter root={AppLayout}>
        <Route path="/" component={() => <div>Content</div>} />
      </MemoryRouter>
    ));
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("contains main element", () => {
    render(() => (
      <MemoryRouter root={AppLayout}>
        <Route path="/" component={() => <div>Content</div>} />
      </MemoryRouter>
    ));
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders children in the main area", () => {
    render(() => (
      <MemoryRouter root={AppLayout}>
        <Route path="/" component={() => <p>Child Element</p>} />
      </MemoryRouter>
    ));
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByText("Child Element"));
  });
});
