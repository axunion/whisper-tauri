import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const mockLoadModels = vi.fn();

let mockWhisperReturn: ReturnType<typeof createMockWhisper>;

function createMockWhisper() {
  return {
    models: () => [],
    selectedModel: () => null,
    file: () => null,
    progress: () => null,
    downloadProgress: () => null,
    result: () => null,
    isProcessing: () => false,
    isDownloading: () => false,
    error: () => null,
    loadModels: mockLoadModels,
    selectModel: vi.fn(),
    setFile: vi.fn(),
    downloadModel: vi.fn(),
    startTranscription: vi.fn(),
    cancelTranscription: vi.fn(),
    reset: vi.fn(),
    clearError: vi.fn(),
  };
}

vi.mock("~/primitives/createWhisper", () => ({
  createWhisper: () => mockWhisperReturn,
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhisperReturn = createMockWhisper();
  });

  describe("render", () => {
    it("renders without error", () => {
      render(() => <App />);
      expect(screen.getByRole("main")).toBeInTheDocument();
    });

    it("shows app title", () => {
      render(() => <App />);
      expect(screen.getByText("Whisper Tauri")).toBeInTheDocument();
    });
  });

  describe("loadModels", () => {
    it("called on mount", () => {
      render(() => <App />);
      expect(mockLoadModels).toHaveBeenCalledOnce();
    });
  });

  describe("canStartTranscription", () => {
    it("disabled when file and model not selected", () => {
      render(() => <App />);
      const button = screen.getByRole("button", {
        name: /start transcription/i,
      });
      expect(button).toBeDisabled();
    });
  });
});
