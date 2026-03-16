import { screen } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import DevMenu from "~/pages/DevMenu";
import { renderWithI18n } from "~/test/helpers";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

describe("DevMenu", () => {
  it("shows Data Reset section", () => {
    renderWithI18n(() => <DevMenu />);
    expect(screen.getByText("データリセット")).toBeInTheDocument();
  });

  it("shows Audio Model Manager section", () => {
    renderWithI18n(() => <DevMenu />);
    expect(screen.getByText("音声モデル管理")).toBeInTheDocument();
  });

  it("shows Clear History button", () => {
    renderWithI18n(() => <DevMenu />);
    expect(
      screen.getByText("履歴クリア", { selector: "button" }),
    ).toBeInTheDocument();
  });

  it("calls loadModels and loadEntries on mount", () => {
    renderWithI18n(() => <DevMenu />);
    expect(invoke).toHaveBeenCalledWith("get_available_models");
    expect(invoke).toHaveBeenCalledWith("history_list", expect.anything());
  });
});

describe("DevMenu in production", () => {
  it("shows fallback message when not in dev mode", () => {
    const env = import.meta.env as Record<string, unknown>;
    const originalDEV = env.DEV;
    env.DEV = false;

    renderWithI18n(() => <DevMenu />);
    expect(
      screen.getByText("このページは開発モードでのみ表示されます。"),
    ).toBeInTheDocument();

    env.DEV = originalDEV;
  });
});
