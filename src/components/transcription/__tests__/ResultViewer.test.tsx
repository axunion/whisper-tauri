import { screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
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
        onClose={noop}
      />
    ));
    expect(screen.getByText("test-audio.wav")).toBeInTheDocument();
  });
});
