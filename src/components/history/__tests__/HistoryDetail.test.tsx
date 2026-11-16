import { fireEvent, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/helpers";
import type { HistoryEntry } from "~/types";
import { HistoryDetail } from "../HistoryDetail";

const baseEntry: HistoryEntry = {
  id: "history-1",
  createdAt: "2026-11-15T05:30:00Z",
  fileName: "録音 2026-11-15 14:30",
  language: "ja",
  modelId: "large-v3-turbo",
  duration: 10000,
  text: "こんにちは",
  segments: [{ start: 0, end: 10000, text: "こんにちは" }],
  vadEnabled: null,
  audioPath: null,
};

const withAudio: HistoryEntry = {
  ...baseEntry,
  audioPath: "/Users/test/Library/audio/history-1.wav",
};

const retranscribeLabel = "この音声をもう一度文字起こし";
const deleteAudioLabel = "音声を削除";

describe("HistoryDetail audio", () => {
  it("shows no player or audio actions when the entry has no kept audio", () => {
    const { container } = renderWithRouter(() => (
      <HistoryDetail
        entry={baseEntry}
        onDeleteAudio={() => {}}
        onRetranscribe={() => {}}
        canRetranscribe
      />
    ));

    expect(container.querySelector("audio")).toBeNull();
    expect(
      screen.queryByRole("button", { name: retranscribeLabel }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: deleteAudioLabel })).toBeNull();
  });

  it("shows the player and both audio actions when audio is kept", () => {
    const { container } = renderWithRouter(() => (
      <HistoryDetail
        entry={withAudio}
        onDeleteAudio={() => {}}
        onRetranscribe={() => {}}
        canRetranscribe
      />
    ));

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute(
      "src",
      expect.stringContaining("history-1.wav"),
    );
    expect(
      screen.getByRole("button", { name: retranscribeLabel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: deleteAudioLabel }),
    ).toBeInTheDocument();
  });

  it("passes the entry to onRetranscribe when the re-transcribe button is clicked", () => {
    const onRetranscribe = vi.fn();
    renderWithRouter(() => (
      <HistoryDetail
        entry={withAudio}
        onDeleteAudio={() => {}}
        onRetranscribe={onRetranscribe}
        canRetranscribe
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: retranscribeLabel }));

    expect(onRetranscribe).toHaveBeenCalledTimes(1);
    expect(onRetranscribe).toHaveBeenCalledWith(withAudio);
  });

  it("disables re-transcription while it would interrupt running work", () => {
    renderWithRouter(() => (
      <HistoryDetail
        entry={withAudio}
        onDeleteAudio={() => {}}
        onRetranscribe={() => {}}
        canRetranscribe={false}
      />
    ));

    expect(
      screen.getByRole("button", { name: retranscribeLabel }),
    ).toBeDisabled();
  });
});
