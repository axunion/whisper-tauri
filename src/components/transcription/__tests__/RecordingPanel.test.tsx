import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/i18n";
import { ja } from "~/i18n/dictionaries/ja";
import type { RecordingLevel } from "~/types";
import { RecordingPanel } from "../RecordingPanel";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  copyFile: vi.fn(() => Promise.resolve()),
}));

const level: RecordingLevel = { level: 0, peakLevel: 0 } as RecordingLevel;

function renderPanel(overrides: {
  isRecording: boolean;
  isPaused: boolean;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
}) {
  return render(() => (
    <I18nProvider locale="ja">
      <RecordingPanel
        devices={[]}
        selectedDevice={null}
        isRecording={overrides.isRecording}
        isPaused={overrides.isPaused}
        level={level}
        duration={12}
        tempFilePath={null}
        onSelectDevice={() => {}}
        onStartRecording={() => {}}
        onPauseRecording={overrides.onPauseRecording ?? (() => {})}
        onResumeRecording={overrides.onResumeRecording ?? (() => {})}
        onStopRecording={() => {}}
        onDiscard={() => {}}
      />
    </I18nProvider>
  ));
}

describe("RecordingPanel pause control", () => {
  it("calls onPauseRecording while recording", () => {
    const onPauseRecording = vi.fn();
    const onResumeRecording = vi.fn();
    renderPanel({
      isRecording: true,
      isPaused: false,
      onPauseRecording,
      onResumeRecording,
    });

    fireEvent.click(
      screen.getByRole("button", { name: ja.recording.pauseRecording }),
    );

    expect(onPauseRecording).toHaveBeenCalledTimes(1);
    expect(onResumeRecording).not.toHaveBeenCalled();
  });

  it("shows the paused label and calls onResumeRecording while paused", () => {
    const onPauseRecording = vi.fn();
    const onResumeRecording = vi.fn();
    renderPanel({
      isRecording: true,
      isPaused: true,
      onPauseRecording,
      onResumeRecording,
    });

    expect(screen.getByText(ja.recording.paused)).toBeInTheDocument();
    expect(screen.queryByText(ja.recording.recording)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: ja.recording.resumeRecording }),
    );

    expect(onResumeRecording).toHaveBeenCalledTimes(1);
    expect(onPauseRecording).not.toHaveBeenCalled();
  });
});
