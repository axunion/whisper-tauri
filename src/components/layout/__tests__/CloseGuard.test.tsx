import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "~/i18n";
import {
  _resetRecordingForTesting,
  createRecording,
} from "~/primitives/createRecording";
import {
  _resetWhisperForTesting,
  createWhisper,
} from "~/primitives/createWhisper";
import { renderWithI18n } from "~/test/helpers";
import type { ModelInfo } from "~/types/whisper";
import { CloseGuard } from "../CloseGuard";

type CloseHandler = (event: { preventDefault: () => void }) => Promise<void>;

const MODEL = {
  id: "small",
  name: "Small",
  size: "142MB",
  sizeBytes: 142,
  description: "",
  downloaded: true,
  bundled: false,
  speedSecondsPerMinuteLow: 1,
  speedSecondsPerMinuteHigh: 2,
  path: "/models/small.bin",
} satisfies ModelInfo;

const RECORDING_MESSAGE =
  "A recording is in progress. Quitting will discard it. Quit anyway?";
const PROCESSING_MESSAGE =
  "A transcription is running. Quitting will stop it. Quit anyway?";
const UNSAVED_MESSAGE =
  "A recording has not been transcribed yet. Quitting will discard it. Quit anyway?";

/** Mounts the guard and returns the close handler plus the unmount function. */
function mountGuard(locale: Locale = "ja") {
  const onCloseRequested = vi.mocked(getCurrentWindow().onCloseRequested);
  onCloseRequested.mockClear();
  const { unmount } = renderWithI18n(() => <CloseGuard />, locale);
  const handler = onCloseRequested.mock
    .calls[0]?.[0] as unknown as CloseHandler;
  return { handler, unmount };
}

/** Starts a transcription that never settles, so the guard sees it as running. */
async function startHangingTranscription(): Promise<void> {
  const whisper = createWhisper();
  whisper.selectModel(MODEL);
  whisper.setFile({ path: "/audio/a.wav", name: "a.wav", size: 1 });
  vi.mocked(invoke).mockImplementation((cmd: string) =>
    cmd === "transcribe_audio"
      ? new Promise(() => {})
      : Promise.resolve(undefined),
  );
  void whisper.startTranscription();
}

/** Records for a moment and stops, leaving an untranscribed WAV behind. */
async function leaveUntranscribedRecording(): Promise<void> {
  const recording = createRecording();
  vi.mocked(invoke).mockResolvedValueOnce(undefined);
  await recording.startRecording();
  vi.mocked(invoke).mockResolvedValueOnce({
    tempFilePath: "/recordings/a.wav",
    durationMs: 1000,
  });
  await recording.stopRecording();
}

describe("CloseGuard", () => {
  beforeEach(() => {
    _resetRecordingForTesting();
    _resetWhisperForTesting();
    vi.mocked(confirm).mockReset();
    vi.mocked(invoke).mockReset();
  });

  it("lets the window close without asking when nothing is at risk", async () => {
    const { handler } = mountGuard();
    const preventDefault = vi.fn();

    await handler({ preventDefault });

    expect(confirm).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("keeps the window open when the user declines during a recording", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await createRecording().startRecording();
    vi.mocked(confirm).mockResolvedValue(false);
    const { handler } = mountGuard();
    const preventDefault = vi.fn();

    await handler({ preventDefault });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("closes when the user confirms despite an untranscribed recording", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await leaveUntranscribedRecording();
    vi.mocked(confirm).mockResolvedValue(true);
    const { handler } = mountGuard();
    const preventDefault = vi.fn();

    await handler({ preventDefault });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("asks about a running transcription and keeps the window open on decline", async () => {
    await startHangingTranscription();
    vi.mocked(confirm).mockResolvedValue(false);
    const { handler } = mountGuard("en");
    const preventDefault = vi.fn();

    await handler({ preventDefault });

    expect(confirm).toHaveBeenCalledWith(
      PROCESSING_MESSAGE,
      expect.objectContaining({ kind: "warning" }),
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("closes without asking once the transcription has finished", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const whisper = createWhisper();
    whisper.selectModel(MODEL);
    whisper.setFile({ path: "/audio/a.wav", name: "a.wav", size: 1 });
    await whisper.startTranscription();
    const { handler } = mountGuard();
    const preventDefault = vi.fn();

    await handler({ preventDefault });

    expect(confirm).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("prefers the recording message when a recording is in progress", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await createRecording().startRecording();
    await startHangingTranscription();
    vi.mocked(confirm).mockResolvedValue(false);
    const { handler } = mountGuard("en");

    await handler({ preventDefault: vi.fn() });

    expect(vi.mocked(confirm).mock.calls[0]?.[0]).toBe(RECORDING_MESSAGE);
  });

  it("prefers the transcription message over the unsaved-recording message", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await leaveUntranscribedRecording();
    await startHangingTranscription();
    vi.mocked(confirm).mockResolvedValue(false);
    const { handler } = mountGuard("en");

    await handler({ preventDefault: vi.fn() });

    expect(vi.mocked(confirm).mock.calls[0]?.[0]).toBe(PROCESSING_MESSAGE);
  });

  it("shows the unsaved-recording message when only an untranscribed WAV remains", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await leaveUntranscribedRecording();
    vi.mocked(confirm).mockResolvedValue(false);
    const { handler } = mountGuard("en");

    await handler({ preventDefault: vi.fn() });

    expect(vi.mocked(confirm).mock.calls[0]?.[0]).toBe(UNSAVED_MESSAGE);
  });

  it("unregisters the close listener on unmount", async () => {
    const unlisten = vi.fn();
    const onCloseRequested = vi.mocked(getCurrentWindow().onCloseRequested);
    onCloseRequested.mockReturnValueOnce(Promise.resolve(unlisten));
    const { unmount } = mountGuard();

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
