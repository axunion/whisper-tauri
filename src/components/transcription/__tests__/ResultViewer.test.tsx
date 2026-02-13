import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
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

describe("ResultViewer", () => {
  it("renders the transcription text", () => {
    render(() => <ResultViewer result={mockResult} />);
    expect(
      screen.getByText("This is a test transcription result."),
    ).toBeInTheDocument();
  });

  it("displays the language", () => {
    render(() => <ResultViewer result={mockResult} />);
    expect(screen.getByText(/en/)).toBeInTheDocument();
  });

  it("displays the duration", () => {
    render(() => <ResultViewer result={mockResult} />);
    expect(screen.getByText(/0m 10s/)).toBeInTheDocument();
  });
});
