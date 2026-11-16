import { fireEvent, screen } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const staleNotice =
  "文字起こしを編集したため、この内容は編集前のものです。再生成すると反映されます。";

const storedSummary = {
  headline: "編集前の見出し",
  tldr: "編集前の要約",
  keywords: [],
  actionItems: [],
  keyPoints: [],
};

// Readiness is module-level state in createTextProcessing, so every mount in
// this file sees the same ready backend.
function mockBackend(summarized: unknown = storedSummary): void {
  const responses: Record<string, unknown> = {
    text_processing_check_server: true,
    text_processing_list_models: [{ id: "gemma-4-e2b", downloaded: true }],
    history_get_all_ai_content: [
      { contentType: "summary", text: JSON.stringify(storedSummary) },
    ],
    text_processing_summarize: summarized,
  };
  vi.mocked(invoke).mockImplementation(
    async (command: string) => responses[command],
  );
}

function openTab(name: string): void {
  const tab = screen.getByRole("tab", { name });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

function editFirstSegmentInTimeline(newText: string): void {
  openTab("タイムライン");
  const [editButton] = screen.getAllByRole("button", {
    name: "この行を編集",
  });
  if (!editButton) throw new Error("no edit button");
  fireEvent.click(editButton);
  const input = screen.getByRole("textbox");
  fireEvent.input(input, { target: { value: newText } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("ResultViewer segment correction", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    mockBackend();
  });

  afterEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("reports the edited segment to onEditSegment", () => {
    const onEditSegment = vi.fn(() => Promise.resolve(true));
    renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileNameText="test-audio.wav"
        onEditSegment={onEditSegment}
      />
    ));

    editFirstSegmentInTimeline("This is a corrected");

    expect(onEditSegment).toHaveBeenCalledWith(0, "This is a corrected");
  });

  it("marks the stored summary as stale after a segment is edited", async () => {
    renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileNameText="test-audio.wav"
        historyId="history-1"
        onEditSegment={() => Promise.resolve(true)}
      />
    ));
    await screen.findByRole("tab", { name: "要約" });
    expect(screen.queryByText(staleNotice)).toBeNull();

    editFirstSegmentInTimeline("This is a corrected");
    openTab("要約");

    // Marked once the save resolves, not on the keystroke.
    expect(await screen.findByText(staleNotice)).toBeInTheDocument();
    expect(screen.getByText("編集前の見出し")).toBeInTheDocument();
  });

  it("does not mark the summary as stale when the edit could not be saved", async () => {
    renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileNameText="test-audio.wav"
        historyId="history-1"
        onEditSegment={() => Promise.resolve(false)}
      />
    ));
    await screen.findByRole("tab", { name: "要約" });

    editFirstSegmentInTimeline("This is a corrected");
    openTab("要約");
    await screen.findByText("編集前の見出し");

    expect(screen.queryByText(staleNotice)).toBeNull();
  });

  it("clears the stale notice once a new summary has been generated", async () => {
    mockBackend({ ...storedSummary, headline: "編集後の見出し" });
    renderWithRouter(() => (
      <ResultViewer
        result={mockResult}
        fileNameText="test-audio.wav"
        historyId="history-1"
        onEditSegment={() => Promise.resolve(true)}
      />
    ));
    await screen.findByRole("tab", { name: "要約" });
    editFirstSegmentInTimeline("This is a corrected");

    const menu = screen.getByRole("button", { name: "AI 処理" });
    fireEvent.pointerDown(menu, { button: 0, pointerType: "mouse" });
    const summarizeItem = await screen.findByRole("menuitem", { name: "要約" });
    fireEvent.pointerUp(summarizeItem, { button: 0, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("button", { name: "実行" }));

    await screen.findByText("編集後の見出し");
    expect(screen.queryByText(staleNotice)).toBeNull();
  });
});
