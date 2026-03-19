import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetSettingsForTesting } from "~/primitives/createSettings";
import App from "../App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
}));

describe("App", () => {
  beforeEach(() => {
    _resetSettingsForTesting({ onboardingCompleted: true, loaded: true });
  });

  it("renders without error", () => {
    render(() => <App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows app title in sidebar", () => {
    render(() => <App />);
    expect(screen.getByText("Whisper Tauri")).toBeInTheDocument();
  });

  it("shows Dashboard as initial page", () => {
    render(() => <App />);
    expect(screen.getByText("音声を文字に")).toBeInTheDocument();
  });
});
