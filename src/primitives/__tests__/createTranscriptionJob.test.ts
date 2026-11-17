import { invoke } from "@tauri-apps/api/core";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import type { ModelInfo, TranscriptionResult } from "../../types";
import { _resetRecordingForTesting, createRecording } from "../createRecording";
import { _resetSettingsForTesting } from "../createSettings";
import {
  _resetTranscriptionJobForTesting,
  createTranscriptionJob,
} from "../createTranscriptionJob";
import { _resetWhisperForTesting, createWhisper } from "../createWhisper";

vi.mock("~/lib/notify", () => ({
  notifyUnlessFocused: vi.fn(() => Promise.resolve()),
}));

vi.mock("~/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { notifyUnlessFocused } from "~/lib/notify";
import { toast } from "~/lib/toast";

const model: ModelInfo = {
  id: "large-v3-turbo",
  name: "Large v3 Turbo",
  size: "1.6GB",
  sizeBytes: 1_739_587_584,
  description: "Recommended",
  downloaded: true,
  bundled: false,
  speedSecondsPerMinuteLow: 3.0,
  speedSecondsPerMinuteHigh: 7.0,
  path: "/models/ggml-large-v3-turbo.bin",
};

const result: TranscriptionResult = {
  taskId: "task-1",
  text: "こんにちは",
  segments: [{ start: 0, end: 1000, text: "こんにちは" }],
  language: "ja",
  duration: 1000,
};

type Handler = (args: Record<string, unknown>) => unknown;

/**
 * Routes `invoke` by command name. Every command the job can reach has a
 * succeeding default; a test overrides only the ones it is about.
 */
function mockBackend(overrides: Record<string, Handler> = {}): void {
  const handlers: Record<string, Handler> = {
    get_available_models: () => [model],
    get_audio_duration: () => 1000,
    ensure_vad_model: () => "/models/vad.bin",
    convert_audio_file: ({ inputPath }) => ({
      outputPath: "/tmp/converted.wav",
      originalPath: inputPath,
    }),
    cleanup_converted_file: () => undefined,
    transcribe_audio: () => result,
    history_save: () => "history-1",
    start_recording: () => undefined,
    stop_recording: () => ({
      tempFilePath: "/recordings/rec.wav",
      durationMs: 1000,
      sampleCount: 16000,
    }),
    cleanup_recording: () => undefined,
    history_attach_recording: () => undefined,
    history_copy_audio: () => undefined,
    ...overrides,
  };
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    const handler = handlers[command];
    if (!handler) throw new Error(`unexpected command: ${command}`);
    return handler((args ?? {}) as Record<string, unknown>);
  });
}

function commandsCalled(): string[] {
  return vi.mocked(invoke).mock.calls.map(([command]) => command);
}

async function selectFile(name: string): Promise<void> {
  const whisper = createWhisper();
  await whisper.loadModels();
  await whisper.selectFile({ path: `/audio/${name}`, name, size: 0 });
}

async function makeRecording(): Promise<void> {
  await createWhisper().loadModels();
  const recording = createRecording();
  await recording.startRecording();
  await recording.stopRecording();
}

const options = {
  completedMessage: "完了",
  batchCompletedMessage: (count: number) => `${count}件完了`,
};

/** A backend call the test resolves itself, to hold a run in one phase. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createTranscriptionJob", () => {
  beforeEach(() => {
    _resetWhisperForTesting();
    _resetRecordingForTesting();
    _resetSettingsForTesting();
    _resetTranscriptionJobForTesting();
    vi.mocked(invoke).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(notifyUnlessFocused).mockClear();
  });

  describe("file run", () => {
    it("transcribes a WAV directly and saves it to history", async () => {
      mockBackend();
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      expect(job.phase()).toBe("idle");

      await job.startFile(options);

      expect(commandsCalled()).not.toContain("convert_audio_file");
      expect(invoke).toHaveBeenCalledWith(
        "transcribe_audio",
        expect.objectContaining({ audioPath: "/audio/meeting.wav" }),
      );
      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: {
          fileName: "meeting.wav",
          language: "ja",
          modelId: "large-v3-turbo",
          duration: 1000,
          text: "こんにちは",
          segments: result.segments,
          vadEnabled: true,
          source: "file",
        },
      });
      expect(job.phase()).toBe("done");
      expect(job.historyId()).toBe("history-1");
      expect(toast.success).toHaveBeenCalledWith("完了");
    });

    it("converts a non-WAV file and transcribes the converted audio", async () => {
      mockBackend();
      await selectFile("talk.mp3");
      const job = createTranscriptionJob();

      await job.startFile(options);

      expect(invoke).toHaveBeenCalledWith("convert_audio_file", {
        inputPath: "/audio/talk.mp3",
      });
      expect(invoke).toHaveBeenCalledWith(
        "transcribe_audio",
        expect.objectContaining({ audioPath: "/tmp/converted.wav" }),
      );
      expect(job.historyId()).toBe("history-1");
    });

    it("stops with an error when conversion fails", async () => {
      mockBackend({
        convert_audio_file: () => {
          throw "FFmpeg not found";
        },
      });
      await selectFile("talk.mp3");
      const job = createTranscriptionJob();

      await job.startFile(options);

      expect(commandsCalled()).not.toContain("transcribe_audio");
      expect(commandsCalled()).not.toContain("history_save");
      expect(job.error()).not.toBeNull();
      expect(job.saveFailed()).toBe(false);
      expect(job.phase()).toBe("idle");
    });

    it("saves nothing when the transcription is cancelled", async () => {
      mockBackend({
        transcribe_audio: () => {
          throw "Cancelled";
        },
      });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();

      await job.startFile(options);

      expect(commandsCalled()).not.toContain("history_save");
      expect(toast.success).not.toHaveBeenCalled();
      expect(job.historyId()).toBeNull();
      expect(job.phase()).toBe("idle");
    });

    it("keeps the result and reports the failure when the history save fails", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();

      await job.startFile(options);

      expect(job.phase()).toBe("done");
      expect(createWhisper().result()).toEqual(result);
      expect(job.historyId()).toBeNull();
      expect(job.saveFailed()).toBe(true);
      expect(job.error()).not.toBeNull();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("clears a previous save failure when the next run starts", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      await job.startFile(options);
      expect(job.saveFailed()).toBe(true);

      mockBackend();
      await job.startFile(options);

      expect(job.saveFailed()).toBe(false);
      expect(job.error()).toBeNull();
      expect(job.historyId()).toBe("history-1");
    });

    it("removes the converted file and the result on reset", async () => {
      mockBackend();
      await selectFile("talk.mp3");
      const job = createTranscriptionJob();
      await job.startFile(options);

      await job.reset();

      expect(invoke).toHaveBeenCalledWith("cleanup_converted_file", {
        filePath: "/tmp/converted.wav",
      });
      expect(job.phase()).toBe("idle");
      expect(job.historyId()).toBeNull();
      expect(createWhisper().file()).toBeNull();
    });

    it("does nothing without a selected file", async () => {
      mockBackend();
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      vi.mocked(invoke).mockClear();

      await job.startFile(options);

      expect(invoke).not.toHaveBeenCalled();
    });

    it("reports converting while the conversion is in flight", async () => {
      const conversion = deferred<unknown>();
      mockBackend({ convert_audio_file: () => conversion.promise });
      await selectFile("talk.mp3");
      const job = createTranscriptionJob();

      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("converting"));

      conversion.resolve({
        outputPath: "/tmp/converted.wav",
        originalPath: "/audio/talk.mp3",
      });
      await run;
      expect(job.phase()).toBe("done");
    });

    it("reports processing while the transcription is in flight", async () => {
      const transcription = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => transcription.promise });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();

      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("processing"));

      transcription.resolve(result);
      await run;
      expect(job.phase()).toBe("done");
    });

    it("drops the previous run's history id as soon as a new run starts", async () => {
      mockBackend();
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      await job.startFile(options);
      expect(job.historyId()).toBe("history-1");

      const transcription = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => transcription.promise });
      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("processing"));

      expect(job.historyId()).toBeNull();

      transcription.resolve(result);
      await run;
    });

    it("ignores a second start while a run is in flight", async () => {
      const transcription = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => transcription.promise });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();

      const first = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("processing"));

      await job.startFile(options);
      expect(job.canStartFile()).toBe(false);

      transcription.resolve(result);
      await first;
      expect(
        commandsCalled().filter((command) => command === "transcribe_audio"),
      ).toHaveLength(1);
      expect(
        commandsCalled().filter((command) => command === "history_save"),
      ).toHaveLength(1);
    });

    it("removes the previous run's converted file before converting the next", async () => {
      mockBackend();
      await selectFile("talk.mp3");
      const job = createTranscriptionJob();
      await job.startFile(options);

      await selectFile("second.mp3");
      vi.mocked(invoke).mockClear();
      await job.startFile(options);

      expect(vi.mocked(invoke).mock.calls[0]).toEqual([
        "cleanup_converted_file",
        { filePath: "/tmp/converted.wav" },
      ]);
      expect(commandsCalled()).toContain("convert_audio_file");
    });

    it("clears a save failure on reset", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      await job.startFile(options);
      expect(job.saveFailed()).toBe(true);

      await job.reset();

      expect(job.saveFailed()).toBe(false);
      expect(job.error()).toBeNull();
      expect(job.phase()).toBe("idle");
    });

    it("cannot start a file run without a downloaded model", async () => {
      mockBackend({
        get_available_models: () => [{ ...model, downloaded: false }],
      });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();

      expect(job.canStartFile()).toBe(false);
      await job.startFile(options);

      expect(commandsCalled()).not.toContain("transcribe_audio");
    });
  });

  describe("queue of files", () => {
    it("selects the first added file and queues the rest, skipping duplicates", async () => {
      mockBackend();
      const job = createTranscriptionJob();

      await job.addFiles(["/a/one.wav", "/a/two.wav", "/a/one.wav"]);
      await job.addFiles(["/a/two.wav", "/a/three.mp3"]);

      expect(createWhisper().file()?.path).toBe("/a/one.wav");
      expect(job.queue().map((f) => f.name)).toEqual(["two.wav", "three.mp3"]);
    });

    it("promotes the next queued file when the selected one is cleared", async () => {
      mockBackend();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav"]);

      await job.clearSelectedFile();
      expect(createWhisper().file()?.path).toBe("/a/two.wav");
      expect(job.queue()).toEqual([]);

      await job.clearSelectedFile();
      expect(createWhisper().file()).toBeNull();
    });

    it("removes a queued file without touching the others", async () => {
      mockBackend();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav", "/a/three.wav"]);

      job.removeQueued("/a/two.wav");

      expect(job.queue().map((f) => f.name)).toEqual(["three.wav"]);
    });

    it("transcribes every file in order, announces once, and returns to the input", async () => {
      mockBackend();
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.mp3", "/a/three.wav"]);

      await job.startFile(options);

      const saved = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "history_save")
        .map(
          ([, args]) =>
            (args as { params: { fileName: string } }).params.fileName,
        );
      expect(saved).toEqual(["one.wav", "two.mp3", "three.wav"]);
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith("3件完了");
      expect(job.phase()).toBe("idle");
      expect(job.queue()).toEqual([]);
      expect(createWhisper().file()).toBeNull();
    });

    it("reports its position while a run over several files is in flight", async () => {
      const first = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => first.promise });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav"]);
      expect(job.batch()).toBeNull();

      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("processing"));
      expect(job.batch()).toEqual({ index: 1, total: 2 });

      mockBackend();
      first.resolve(result);
      await run;
      expect(job.batch()).toBeNull();
    });

    it("stops at a failing file and keeps the rest queued", async () => {
      let calls = 0;
      mockBackend({
        transcribe_audio: () => {
          calls += 1;
          if (calls === 2) throw "Transcription failed: boom";
          return result;
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav", "/a/three.wav"]);

      await job.startFile(options);

      expect(calls).toBe(2);
      expect(createWhisper().file()?.name).toBe("two.wav");
      expect(job.queue().map((f) => f.name)).toEqual(["three.wav"]);
      expect(createWhisper().error()).not.toBeNull();
      // The one file that did finish is still announced.
      expect(toast.success).toHaveBeenCalledWith("完了");
      expect(job.phase()).toBe("idle");
    });

    it("picks up files added while the run is in flight", async () => {
      const first = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => first.promise });
      await selectFile("one.wav");
      const job = createTranscriptionJob();
      const run = job.startFile(options);
      await vi.waitFor(() =>
        expect(invoke).toHaveBeenCalledWith(
          "transcribe_audio",
          expect.anything(),
        ),
      );

      await job.addFiles(["/a/late.wav"]);
      mockBackend();
      first.resolve(result);
      await run;

      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({ fileName: "late.wav" }),
      });
      expect(toast.success).toHaveBeenCalledWith("2件完了");
      // Once per run, even though the first file started alone.
      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("keeps the files still queued when a result is closed after a failed save", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav", "/a/three.wav"]);
      await job.startFile(options);
      expect(job.phase()).toBe("done");

      await job.reset();

      expect(job.phase()).toBe("idle");
      expect(createWhisper().file()?.name).toBe("two.wav");
      expect(job.queue().map((f) => f.name)).toEqual(["three.wav"]);
    });

    it("stops after a file whose audio could not be copied, keeping the error", async () => {
      mockBackend({
        history_copy_audio: () => {
          throw "IO error: no such file";
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.prepareRetranscription({
        id: "history-0",
        path: "/audio/history-0.wav",
        name: "録音",
      });
      await job.addFiles(["/a/next.wav"]);

      await job.startFile(options);

      expect(job.attachFailed()).toBe(true);
      expect(job.queue().map((f) => f.name)).toEqual(["next.wav"]);
      expect(job.phase()).toBe("done");
    });

    it("puts the selected file back in the queue when a recording takes over", async () => {
      mockBackend();
      await makeRecording();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav"]);

      await job.startRecording({ ...options, name: "録音 2026-11-15 14:30" });
      await job.reset();

      expect(createWhisper().file()?.name).toBe("one.wav");
      expect(job.queue().map((f) => f.name)).toEqual(["two.wav"]);
    });

    it("starts each file with the previous run's progress cleared", async () => {
      mockBackend();
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav"]);
      await job.startFile(options);
      await job.reset();

      const transcription = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => transcription.promise });
      await job.addFiles(["/a/two.wav"]);
      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("processing"));

      expect(createWhisper().progress()).toBeNull();

      transcription.resolve(result);
      await run;
    });

    it("keeps a single file's result on screen with the ordinary message", async () => {
      mockBackend();
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav"]);

      await job.startFile(options);

      expect(job.phase()).toBe("done");
      expect(toast.success).toHaveBeenCalledWith("完了");
    });

    it("cancelling the first of several files leaves the rest queued and announces nothing", async () => {
      mockBackend({
        transcribe_audio: () => {
          throw "Cancelled";
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav", "/a/three.wav"]);

      await job.startFile(options);

      expect(commandsCalled()).not.toContain("history_save");
      expect(createWhisper().file()?.name).toBe("one.wav");
      expect(job.queue().map((f) => f.name)).toEqual(["two.wav", "three.wav"]);
      expect(toast.success).not.toHaveBeenCalled();
      expect(notifyUnlessFocused).not.toHaveBeenCalled();
      expect(job.phase()).toBe("idle");
    });

    it("stops the run when the first file's history save fails and keeps the rest queued", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.wav", "/a/two.wav", "/a/three.wav"]);

      await job.startFile(options);

      expect(
        commandsCalled().filter((command) => command === "transcribe_audio"),
      ).toHaveLength(1);
      expect(
        commandsCalled().filter((command) => command === "history_save"),
      ).toHaveLength(1);
      expect(job.saveFailed()).toBe(true);
      expect(createWhisper().file()?.name).toBe("one.wav");
      expect(job.queue().map((f) => f.name)).toEqual(["two.wav", "three.wav"]);
      expect(toast.success).not.toHaveBeenCalled();
      expect(notifyUnlessFocused).not.toHaveBeenCalled();
    });

    it("stops at a file whose conversion fails and keeps the rest queued", async () => {
      let conversions = 0;
      mockBackend({
        convert_audio_file: ({ inputPath }) => {
          conversions += 1;
          if (conversions === 2) throw "FFmpeg failed";
          return {
            outputPath: `/tmp/converted-${conversions}.wav`,
            originalPath: inputPath,
          };
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.mp3", "/a/two.mp3", "/a/three.mp3"]);

      await job.startFile(options);

      expect(
        commandsCalled().filter((command) => command === "transcribe_audio"),
      ).toHaveLength(1);
      expect(createWhisper().file()?.name).toBe("two.mp3");
      expect(job.queue().map((f) => f.name)).toEqual(["three.mp3"]);
      expect(job.error()).not.toBeNull();
      expect(toast.success).toHaveBeenCalledWith("完了");
      // Not "done": the first file's result must not show under the second.
      expect(job.phase()).toBe("idle");
      expect(createWhisper().result()).toBeNull();
    });

    it("removes the first file's converted audio before converting the next", async () => {
      let conversions = 0;
      mockBackend({
        convert_audio_file: ({ inputPath }) => {
          conversions += 1;
          return {
            outputPath: `/tmp/converted-${conversions}.wav`,
            originalPath: inputPath,
          };
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.addFiles(["/a/one.mp3", "/a/two.mp3"]);

      await job.startFile(options);

      const calls = vi.mocked(invoke).mock.calls;
      const cleanupFirst = calls.findIndex(
        ([command, args]) =>
          command === "cleanup_converted_file" &&
          (args as { filePath: string }).filePath === "/tmp/converted-1.wav",
      );
      const convertSecond = calls.findIndex(
        ([command, args]) =>
          command === "convert_audio_file" &&
          (args as { inputPath: string }).inputPath === "/a/two.mp3",
      );
      expect(cleanupFirst).toBeGreaterThanOrEqual(0);
      expect(cleanupFirst).toBeLessThan(convertSecond);
    });

    it("does not allow starting while the next file of a run is being prepared", async () => {
      const job = createTranscriptionJob();
      const seen: { phase: string; canStart: boolean }[] = [];
      mockBackend({
        cleanup_converted_file: () => {
          // The first cleanup comes from the second file's preparation, after
          // the first file is saved and before anything is converting.
          if (seen.length === 0) {
            seen.push({ phase: job.phase(), canStart: job.canStartFile() });
          }
        },
      });
      await createWhisper().loadModels();
      await job.addFiles(["/a/one.mp3", "/a/two.mp3"]);

      await job.startFile(options);

      expect(seen).toEqual([{ phase: "processing", canStart: false }]);
    });

    it("replaces a finished result on screen when files are added", async () => {
      mockBackend();
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      await job.startFile(options);
      expect(job.phase()).toBe("done");

      await job.addFiles(["/a/next.wav"]);

      expect(job.phase()).toBe("idle");
      expect(job.historyId()).toBeNull();
      expect(createWhisper().file()?.path).toBe("/a/next.wav");
      expect(job.queue()).toEqual([]);
    });
  });

  describe("completion notification", () => {
    it("notifies once the result is saved", async () => {
      mockBackend();
      await selectFile("meeting.wav");

      await createTranscriptionJob().startFile(options);

      expect(notifyUnlessFocused).toHaveBeenCalledWith("完了", "meeting.wav");
    });

    it("does not notify when the result could not be saved", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await selectFile("meeting.wav");

      await createTranscriptionJob().startFile(options);

      expect(notifyUnlessFocused).not.toHaveBeenCalled();
    });

    it("does not notify when the setting is off", async () => {
      _resetSettingsForTesting({ notifyOnComplete: false });
      mockBackend();
      await selectFile("meeting.wav");

      await createTranscriptionJob().startFile(options);

      expect(notifyUnlessFocused).not.toHaveBeenCalled();
    });

    it("notifies with the recording's name", async () => {
      mockBackend();
      await makeRecording();

      await createTranscriptionJob().startRecording({
        ...options,
        name: "録音 2026-11-15 14:30",
      });

      expect(notifyUnlessFocused).toHaveBeenCalledWith(
        "完了",
        "録音 2026-11-15 14:30",
      );
    });

    describe("when the notification API rejects", () => {
      let consoleError: MockInstance;

      beforeEach(() => {
        consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      });

      afterEach(() => {
        consoleError.mockRestore();
      });

      it("still completes the run when the notification cannot be sent", async () => {
        vi.mocked(notifyUnlessFocused).mockRejectedValueOnce(
          new Error("notification failed"),
        );
        mockBackend();
        await selectFile("meeting.wav");
        const job = createTranscriptionJob();

        await job.startFile(options);

        expect(job.phase()).toBe("done");
        expect(job.historyId()).toBe("history-1");
        expect(job.error()).toBeNull();
        await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
      });
    });
  });

  describe("re-transcription of kept audio", () => {
    const source = {
      id: "history-0",
      path: "/audio/history-0.wav",
      name: "録音 2026-11-15 14:30",
    };

    it("saves a new recording entry and copies the audio to it", async () => {
      mockBackend();
      await createWhisper().loadModels();
      const job = createTranscriptionJob();

      await job.prepareRetranscription(source);
      await job.startFile(options);

      expect(invoke).toHaveBeenCalledWith(
        "transcribe_audio",
        expect.objectContaining({ audioPath: "/audio/history-0.wav" }),
      );
      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({
          fileName: "録音 2026-11-15 14:30",
          source: "recording",
        }),
      });
      expect(invoke).toHaveBeenCalledWith("history_copy_audio", {
        fromId: "history-0",
        toId: "history-1",
      });
      expect(job.error()).toBeNull();
    });

    it("ignores a re-transcription request while a run is in flight", async () => {
      const transcription = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => transcription.promise });
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.isRunning()).toBe(true));

      await job.prepareRetranscription(source);

      expect(createWhisper().file()?.name).toBe("meeting.wav");
      transcription.resolve(result);
      await run;
      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({
          fileName: "meeting.wav",
          source: "file",
        }),
      });
    });

    it("replaces a finished result still on screen with the new selection", async () => {
      mockBackend();
      await selectFile("meeting.wav");
      const job = createTranscriptionJob();
      await job.startFile(options);
      expect(job.phase()).toBe("done");

      await job.prepareRetranscription(source);

      expect(job.phase()).toBe("idle");
      expect(job.historyId()).toBeNull();
      expect(createWhisper().file()?.path).toBe("/audio/history-0.wav");

      await job.startFile(options);
      expect(invoke).toHaveBeenCalledWith("history_copy_audio", {
        fromId: "history-0",
        toId: "history-1",
      });
    });

    it("copies the kept audio only to the re-transcribed file of a run", async () => {
      let saves = 0;
      mockBackend({
        history_save: () => {
          saves += 1;
          return `history-${saves}`;
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.prepareRetranscription(source);
      await job.addFiles(["/a/ordinary.wav"]);

      await job.startFile(options);

      expect(
        commandsCalled().filter((command) => command === "history_copy_audio"),
      ).toHaveLength(1);
      expect(invoke).toHaveBeenCalledWith("history_copy_audio", {
        fromId: "history-0",
        toId: "history-1",
      });
      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({
          fileName: "ordinary.wav",
          source: "file",
        }),
      });
    });

    it("names the source entry until its audio has been copied", async () => {
      const transcription = deferred<TranscriptionResult>();
      mockBackend({ transcribe_audio: () => transcription.promise });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      expect(job.audioSourceId()).toBeNull();

      await job.prepareRetranscription(source);
      expect(job.audioSourceId()).toBe("history-0");

      const run = job.startFile(options);
      await vi.waitFor(() => expect(job.phase()).toBe("processing"));
      expect(job.audioSourceId()).toBe("history-0");

      mockBackend();
      transcription.resolve(result);
      await run;
      expect(job.audioSourceId()).toBeNull();
    });

    it("still saves a recording with its audio when restarted after a cancel", async () => {
      mockBackend({
        transcribe_audio: () => {
          throw "Cancelled";
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.prepareRetranscription(source);
      await job.startFile(options);
      // Cancelled: the source's entry stays protected for the next attempt.
      expect(job.audioSourceId()).toBe("history-0");

      mockBackend();
      await job.startFile(options);

      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({ source: "recording" }),
      });
      expect(invoke).toHaveBeenCalledWith("history_copy_audio", {
        fromId: "history-0",
        toId: "history-1",
      });
    });

    it("stops protecting the source entry once its audio is deselected", async () => {
      mockBackend();
      await createWhisper().loadModels();
      const job = createTranscriptionJob();
      await job.prepareRetranscription(source);
      expect(job.audioSourceId()).toBe("history-0");

      await job.clearSelectedFile();

      expect(job.audioSourceId()).toBeNull();
    });

    it("treats a different file picked afterwards as an ordinary file", async () => {
      mockBackend();
      const job = createTranscriptionJob();
      await job.prepareRetranscription(source);

      await selectFile("meeting.wav");
      await job.startFile(options);

      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({ source: "file" }),
      });
      expect(commandsCalled()).not.toContain("history_copy_audio");
    });

    it("reports a failed copy without calling the save a failure", async () => {
      mockBackend({
        history_copy_audio: () => {
          throw "IO error: no such file";
        },
      });
      await createWhisper().loadModels();
      const job = createTranscriptionJob();

      await job.prepareRetranscription(source);
      await job.startFile(options);

      expect(job.historyId()).toBe("history-1");
      expect(job.saveFailed()).toBe(false);
      expect(job.attachFailed()).toBe(true);
    });

    it("forgets the source on reset, so the same path later saves as a file", async () => {
      mockBackend();
      const job = createTranscriptionJob();
      await job.prepareRetranscription(source);
      await job.reset();

      await selectFile("history-0.wav");
      await job.startFile(options);

      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({ source: "file" }),
      });
      expect(commandsCalled()).not.toContain("history_copy_audio");
    });

    it("does not convert an upper-case .WAV path", async () => {
      mockBackend();
      await selectFile("MEETING.WAV");
      const job = createTranscriptionJob();

      await job.startFile(options);

      expect(commandsCalled()).not.toContain("convert_audio_file");
      expect(invoke).toHaveBeenCalledWith(
        "transcribe_audio",
        expect.objectContaining({ audioPath: "/audio/MEETING.WAV" }),
      );
    });

    it("converts a path without an extension", async () => {
      mockBackend();
      await selectFile("recording");
      const job = createTranscriptionJob();

      await job.startFile(options);

      expect(invoke).toHaveBeenCalledWith("convert_audio_file", {
        inputPath: "/audio/recording",
      });
    });
  });

  describe("recording run", () => {
    const recordingOptions = { ...options, name: "録音 2026-11-15 14:30" };

    it("saves under the given name and keeps the WAV as the entry's audio", async () => {
      mockBackend();
      await makeRecording();
      const job = createTranscriptionJob();
      expect(job.canStartRecording()).toBe(true);

      await job.startRecording(recordingOptions);

      expect(invoke).toHaveBeenCalledWith(
        "transcribe_audio",
        expect.objectContaining({ audioPath: "/recordings/rec.wav" }),
      );
      expect(invoke).toHaveBeenCalledWith("history_save", {
        params: expect.objectContaining({
          fileName: "録音 2026-11-15 14:30",
          source: "recording",
        }),
      });
      expect(invoke).toHaveBeenCalledWith("history_attach_recording", {
        id: "history-1",
        recordingPath: "/recordings/rec.wav",
      });
      // Moved, not deleted — and no longer an untranscribed recording.
      expect(commandsCalled()).not.toContain("cleanup_recording");
      expect(createRecording().tempFilePath()).toBeNull();
      expect(job.error()).toBeNull();
    });

    it("keeps the recording and reports it when the audio cannot be attached", async () => {
      mockBackend({
        history_attach_recording: () => {
          throw "IO error: permission denied";
        },
      });
      await makeRecording();
      const job = createTranscriptionJob();

      await job.startRecording(recordingOptions);

      expect(job.historyId()).toBe("history-1");
      expect(createRecording().tempFilePath()).toBe("/recordings/rec.wav");
      expect(job.error()).not.toBeNull();
      // The transcription itself is safe, so this is not a save failure.
      expect(job.saveFailed()).toBe(false);
      expect(job.attachFailed()).toBe(true);
    });

    it("keeps the WAV when the transcription fails", async () => {
      mockBackend({
        transcribe_audio: () => {
          throw "Transcription failed: boom";
        },
      });
      await makeRecording();
      const job = createTranscriptionJob();

      await job.startRecording(recordingOptions);

      expect(commandsCalled()).not.toContain("history_attach_recording");
      expect(createRecording().tempFilePath()).toBe("/recordings/rec.wav");
    });

    it("keeps the WAV when the history save fails", async () => {
      mockBackend({
        history_save: () => {
          throw "Database error: disk full";
        },
      });
      await makeRecording();
      const job = createTranscriptionJob();

      await job.startRecording(recordingOptions);

      expect(commandsCalled()).not.toContain("history_attach_recording");
      expect(createRecording().tempFilePath()).toBe("/recordings/rec.wav");
      expect(job.saveFailed()).toBe(true);
    });

    it("deletes the WAV and clears the input when the recording is discarded", async () => {
      mockBackend();
      await makeRecording();
      const job = createTranscriptionJob();

      await job.discardRecording();

      expect(invoke).toHaveBeenCalledWith("cleanup_recording", {
        path: "/recordings/rec.wav",
      });
      expect(job.canStartRecording()).toBe(false);
    });
  });
});
