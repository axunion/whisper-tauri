import { render, screen } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import DevMenu from "~/pages/DevMenu";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

describe("DevMenu", () => {
  it("shows Debug Log section", () => {
    render(() => <DevMenu />);
    expect(screen.getByText("Debug Log")).toBeInTheDocument();
  });

  it("shows Cache Clear section", () => {
    render(() => <DevMenu />);
    expect(screen.getByText("Cache Clear")).toBeInTheDocument();
  });

  it("shows Model Manager section", () => {
    render(() => <DevMenu />);
    expect(screen.getByText("Model Manager")).toBeInTheDocument();
  });

  it("shows Clear and Copy buttons in Debug Log", () => {
    render(() => <DevMenu />);
    expect(
      screen.getByText("Clear", { selector: "button" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Copy", { selector: "button" }),
    ).toBeInTheDocument();
  });

  it("shows Clear History button", () => {
    render(() => <DevMenu />);
    expect(
      screen.getByText("Clear History", { selector: "button" }),
    ).toBeInTheDocument();
  });

  it("shows Reset Settings button", () => {
    render(() => <DevMenu />);
    expect(
      screen.getByText("Reset Settings", { selector: "button" }),
    ).toBeInTheDocument();
  });

  it("calls loadModels and loadEntries on mount", () => {
    render(() => <DevMenu />);
    expect(invoke).toHaveBeenCalledWith("get_available_models");
    expect(invoke).toHaveBeenCalledWith("history_list", expect.anything());
  });
});

describe("DevMenu in production", () => {
  it("shows fallback message when not in dev mode", () => {
    const env = import.meta.env as Record<string, unknown>;
    const originalDEV = env.DEV;
    env.DEV = false;

    render(() => <DevMenu />);
    expect(
      screen.getByText("This page is only available in development mode."),
    ).toBeInTheDocument();

    env.DEV = originalDEV;
  });
});
