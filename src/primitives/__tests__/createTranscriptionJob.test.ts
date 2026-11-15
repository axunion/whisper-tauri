import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelInfo, TranscriptionResult } from "../../types";
import { _resetRecordingForTesting, createRecording } from "../createRecording";
import { _resetSettingsForTesting } from "../createSettings";
import {
  _resetTranscriptionJobForTesting,
  createTranscriptionJob,
} from "../createTranscriptionJob";
import { _resetWhisperForTesting, createWhisper } from "../createWhisper";

vi.mock("~/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

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

const options = { completedMessage: "完了" };

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

  describe("recording run", () => {
    const recordingOptions = { ...options, name: "録音 2026-11-15 14:30" };

    it("saves under the given name and discards the WAV after a successful save", async () => {
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
      expect(invoke).toHaveBeenCalledWith("cleanup_recording", {
        path: "/recordings/rec.wav",
      });
      expect(createRecording().tempFilePath()).toBeNull();
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

      expect(commandsCalled()).not.toContain("cleanup_recording");
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

      expect(commandsCalled()).not.toContain("cleanup_recording");
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
