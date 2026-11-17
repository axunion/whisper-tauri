import { screen } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "~/components/ui/sidebar";
import { _resetSettingsForTesting } from "~/primitives/createSettings";
import {
  _resetTranscriptionJobForTesting,
  createTranscriptionJob,
} from "~/primitives/createTranscriptionJob";
import {
  _resetWhisperForTesting,
  createWhisper,
} from "~/primitives/createWhisper";
import { renderWithRouter } from "~/test/helpers";
import { TranscriptionIndicator } from "../TranscriptionIndicator";

const model = {
  id: "small",
  name: "Small",
  size: "466MB",
  sizeBytes: 488_636_416,
  description: "",
  downloaded: true,
  bundled: false,
  speedSecondsPerMinuteLow: 1.5,
  speedSecondsPerMinuteHigh: 3.5,
  path: "/models/ggml-small.bin",
};

const transcriptionResult = {
  taskId: "t",
  text: "",
  segments: [],
  language: "ja",
  duration: 0,
};

/** A backend call the test resolves itself, to hold a run in one phase. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** The handler createWhisper registered for `whisper:progress` at import. */
function progressListener(): (event: {
  payload: { taskId: string; progress: number; elapsedMs: number };
}) => void {
  const call = vi
    .mocked(listen)
    .mock.calls.find(([name]) => name === "whisper:progress");
  if (!call) throw new Error("whisper:progress listener not registered");
  return call[1] as unknown as ReturnType<typeof progressListener>;
}

function renderIndicator() {
  return renderWithRouter(() => (
    <SidebarProvider>
      <TranscriptionIndicator />
    </SidebarProvider>
  ));
}

describe("TranscriptionIndicator", () => {
  beforeEach(() => {
    _resetWhisperForTesting();
    _resetSettingsForTesting();
    _resetTranscriptionJobForTesting();
    vi.mocked(invoke).mockReset();
  });

  it("renders nothing while no run is in flight", () => {
    renderIndicator();

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("links back to the transcription page while a run is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_available_models") return [model];
      if (command === "transcribe_audio") {
        return new Promise((resolve) => {
          finish = resolve;
        });
      }
      if (command === "history_save") return "history-1";
      return undefined;
    });
    const whisper = createWhisper();
    await whisper.loadModels();
    await whisper.selectFile({
      path: "/a/meeting.wav",
      name: "meeting.wav",
      size: 0,
    });
    const job = createTranscriptionJob();
    renderIndicator();

    const run = job.startFile({
      completedMessage: "完了",
      batchCompletedMessage: () => "完了",
    });

    expect(await screen.findByRole("status")).toHaveTextContent("文字起こし中");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/transcription");

    // The indicator appears as soon as the run starts; wait for the backend
    // call itself before resolving it.
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "transcribe_audio",
        expect.anything(),
      ),
    );

    finish({
      taskId: "t",
      text: "",
      segments: [],
      language: "ja",
      duration: 0,
    });
    await run;
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("labels the run as converting while a non-WAV file is being converted", async () => {
    const conversion = deferred<unknown>();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_available_models") return [model];
      if (command === "get_audio_duration") return 1000;
      if (command === "convert_audio_file") return conversion.promise;
      if (command === "transcribe_audio") return transcriptionResult;
      if (command === "history_save") return "history-1";
      return undefined;
    });
    const whisper = createWhisper();
    await whisper.loadModels();
    await whisper.selectFile({
      path: "/a/talk.mp3",
      name: "talk.mp3",
      size: 0,
    });
    const job = createTranscriptionJob();
    renderIndicator();

    const run = job.startFile({
      completedMessage: "完了",
      batchCompletedMessage: () => "完了",
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "ファイルを変換中...",
    );
    conversion.resolve({
      outputPath: "/audio/talk-converted.wav",
      originalPath: "/a/talk.mp3",
    });
    await run;
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the transcription percentage while processing", async () => {
    const transcription = deferred<unknown>();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_available_models") return [model];
      if (command === "transcribe_audio") return transcription.promise;
      if (command === "history_save") return "history-1";
      return undefined;
    });
    const whisper = createWhisper();
    await whisper.loadModels();
    await whisper.selectFile({
      path: "/a/meeting.wav",
      name: "meeting.wav",
      size: 0,
    });
    const job = createTranscriptionJob();
    renderIndicator();

    const run = job.startFile({
      completedMessage: "完了",
      batchCompletedMessage: () => "完了",
    });
    await screen.findByRole("status");

    const onProgress = progressListener();
    onProgress({
      payload: { taskId: "t", progress: 42.4, elapsedMs: 1000 },
    });

    expect(await screen.findByText("42%")).toBeInTheDocument();

    transcription.resolve(transcriptionResult);
    await run;
    expect(screen.queryByRole("status")).toBeNull();
  });
});
