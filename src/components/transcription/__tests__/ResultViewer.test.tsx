import { fireEvent, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/helpers";
import type { TranscriptionResult } from "~/types";
import { ResultViewer } from "../ResultViewer";

const mockResult: TranscriptionResult = {
  taskId: "test-task-1",
  text: "This is a test transcription result.",
  segments: [
    { start: 0, end: 5000, text: "This is a test" },
    { start: 5000, end: 10000, text: " transcription result." },
  ],
  language: "en",
  duration: 10000,
};

const noop = () => {};

describe("ResultViewer", () => {
  it("renders the transcription text", () => {
    renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileName="test-audio.wav"
        fileNameText="test-audio.wav"
        onClose={noop}
      />
    ));
    expect(
      screen.getByText("This is a test transcription result."),
    ).toBeInTheDocument();
  });

  it("displays the file name", () => {
    renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileName="test-audio.wav"
        fileNameText="test-audio.wav"
        onClose={noop}
      />
    ));
    expect(screen.getByText("test-audio.wav")).toBeInTheDocument();
  });
});

describe("ResultViewer audio playback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a player for the given source", () => {
    const { container } = renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileNameText="test-audio.wav"
        audio={{ src: "asset://localhost/audio/a.wav" }}
      />
    ));
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute("src", "asset://localhost/audio/a.wav");
  });

  it("seeks the player and starts playback when a timeline row is clicked", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const { container } = renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileNameText="test-audio.wav"
        audio={{ src: "asset://localhost/audio/a.wav" }}
      />
    ));
    const timelineTab = screen.getByRole("tab", { name: "タイムライン" });
    fireEvent.mouseDown(timelineTab);
    fireEvent.click(timelineTab);

    fireEvent.click(
      screen.getByRole("button", { name: /transcription result/ }),
    );

    const audio = container.querySelector("audio");
    expect(audio?.currentTime).toBe(5);
    expect(play).toHaveBeenCalled();
  });

  it("renders no player and plain timeline rows without an audio source", () => {
    const { container } = renderWithRouter(() => (
      <ResultViewer result={mockResult} fileNameText="test-audio.wav" />
    ));
    expect(container.querySelector("audio")).toBeNull();

    const timelineTab = screen.getByRole("tab", { name: "タイムライン" });
    fireEvent.mouseDown(timelineTab);
    fireEvent.click(timelineTab);

    expect(
      screen.queryByRole("button", { name: /transcription result/ }),
    ).toBeNull();
    expect(screen.getByText("transcription result.")).toBeInTheDocument();
  });
});
