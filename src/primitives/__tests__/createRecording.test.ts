import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type {
  AudioDevice,
  RecordingLevel,
  RecordingStopResult,
} from "../../types";
import { _resetRecordingForTesting, createRecording } from "../createRecording";

const mockDevice = (overrides?: Partial<AudioDevice>): AudioDevice => ({
  id: "default-mic",
  name: "Built-in Microphone",
  isDefault: true,
  ...overrides,
});

const mockStopResult: RecordingStopResult = {
  tempFilePath: "/tmp/recording-123.wav",
  durationMs: 5000,
  sampleCount: 240000,
};

describe("createRecording", () => {
  beforeEach(() => {
    _resetRecordingForTesting();
    vi.mocked(invoke).mockReset();
  });

  describe("initial state", () => {
    it("should have empty devices array", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.devices()).toEqual([]);
        dispose();
      });
    });

    it("should have null selectedDevice", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.selectedDevice()).toBeNull();
        dispose();
      });
    });

    it("should have isRecording as false", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.isRecording()).toBe(false);
        dispose();
      });
    });

    it("should have null level", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.level()).toBeNull();
        dispose();
      });
    });

    it("should have null tempFilePath", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.tempFilePath()).toBeNull();
        dispose();
      });
    });

    it("should have duration as 0", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.duration()).toBe(0);
        dispose();
      });
    });

    it("should have null error", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        expect(recording.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("loadDevices", () => {
    it("should invoke list_audio_devices", async () => {
      const devices = [mockDevice()];
      vi.mocked(invoke).mockResolvedValueOnce(devices);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.loadDevices();

        expect(invoke).toHaveBeenCalledWith("list_audio_devices");
        dispose();
      });
    });

    it("should set devices state with result", async () => {
      const devices = [
        mockDevice(),
        mockDevice({
          id: "external-mic",
          name: "External Mic",
          isDefault: false,
        }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(devices);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.loadDevices();

        expect(recording.devices()).toEqual(devices);
        dispose();
      });
    });

    it("should auto-select default device", async () => {
      const devices = [
        mockDevice({ id: "external", name: "External", isDefault: false }),
        mockDevice({ id: "default", name: "Default Mic", isDefault: true }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(devices);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.loadDevices();

        expect(recording.selectedDevice()?.id).toBe("default");
        dispose();
      });
    });

    it("should auto-select first device if no default", async () => {
      const devices = [
        mockDevice({ id: "mic-1", name: "Mic 1", isDefault: false }),
        mockDevice({ id: "mic-2", name: "Mic 2", isDefault: false }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(devices);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.loadDevices();

        expect(recording.selectedDevice()?.id).toBe("mic-1");
        dispose();
      });
    });

    it("should not auto-select if device already selected", async () => {
      const existing = mockDevice({ id: "existing", name: "Existing" });
      const devices = [
        mockDevice({ id: "default", name: "Default", isDefault: true }),
      ];
      vi.mocked(invoke).mockResolvedValueOnce(devices);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        recording.selectDevice(existing);
        await recording.loadDevices();

        expect(recording.selectedDevice()?.id).toBe("existing");
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Failed to list devices"),
      );

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.loadDevices();

        expect(recording.error()).toEqual(
          expect.objectContaining({
            code: "UNKNOWN_ERROR",
            details: "Failed to list devices",
          }),
        );
        dispose();
      });
    });
  });

  describe("selectDevice", () => {
    it("should set the selected device", () => {
      createRoot((dispose) => {
        const recording = createRecording();
        const device = mockDevice();

        recording.selectDevice(device);

        expect(recording.selectedDevice()).toEqual(device);
        dispose();
      });
    });
  });

  describe("startRecording", () => {
    it("should invoke start_recording with device id", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        recording.selectDevice(mockDevice({ id: "my-mic" }));
        await recording.startRecording();

        expect(invoke).toHaveBeenCalledWith("start_recording", {
          deviceId: "my-mic",
        });
        dispose();
      });
    });

    it("should set isRecording to true", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        expect(recording.isRecording()).toBe(false);

        await recording.startRecording();

        expect(recording.isRecording()).toBe(true);
        dispose();
      });
    });

    it("should reset state before starting", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();

        expect(recording.error()).toBeNull();
        expect(recording.tempFilePath()).toBeNull();
        expect(recording.duration()).toBe(0);
        expect(recording.level()).toBeNull();
        dispose();
      });
    });

    it("should not start if already recording", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();
        vi.mocked(invoke).mockClear();

        await recording.startRecording();

        expect(invoke).not.toHaveBeenCalled();
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("Microphone access denied"),
      );

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();

        expect(recording.error()).toEqual(
          expect.objectContaining({
            code: "UNKNOWN_ERROR",
            details: "Microphone access denied",
          }),
        );
        expect(recording.isRecording()).toBe(false);
        dispose();
      });
    });
  });

  describe("stopRecording", () => {
    it("should invoke stop_recording and return result", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockStopResult);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();
        const result = await recording.stopRecording();

        expect(invoke).toHaveBeenCalledWith("stop_recording");
        expect(result).toEqual(mockStopResult);
        dispose();
      });
    });

    it("should set isRecording to false", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockStopResult);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();
        expect(recording.isRecording()).toBe(true);

        await recording.stopRecording();

        expect(recording.isRecording()).toBe(false);
        dispose();
      });
    });

    it("should set tempFilePath and duration from result", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockStopResult);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();
        await recording.stopRecording();

        expect(recording.tempFilePath()).toBe("/tmp/recording-123.wav");
        expect(recording.duration()).toBe(5000);
        dispose();
      });
    });

    it("should return null if not recording", async () => {
      await createRoot(async (dispose) => {
        const recording = createRecording();
        const result = await recording.stopRecording();

        expect(result).toBeNull();
        dispose();
      });
    });

    it("should set error on failure and reset isRecording", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Stop failed"));

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();
        const result = await recording.stopRecording();

        expect(result).toBeNull();
        expect(recording.isRecording()).toBe(false);
        expect(recording.error()).toEqual(
          expect.objectContaining({
            code: "UNKNOWN_ERROR",
            details: "Stop failed",
          }),
        );
        dispose();
      });
    });
  });

  describe("cleanup", () => {
    it("should invoke cleanup_recording with path", async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockStopResult)
        .mockResolvedValueOnce(undefined);

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.startRecording();
        await recording.stopRecording();
        await recording.cleanup();

        expect(invoke).toHaveBeenCalledWith("cleanup_recording", {
          path: "/tmp/recording-123.wav",
        });
        expect(recording.tempFilePath()).toBeNull();
        dispose();
      });
    });

    it("should do nothing if no temp file path", async () => {
      await createRoot(async (dispose) => {
        const recording = createRecording();
        vi.mocked(invoke).mockClear();

        await recording.cleanup();

        expect(invoke).not.toHaveBeenCalled();
        dispose();
      });
    });
  });

  describe("clearError", () => {
    it("should set error to null", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Some error"));

      await createRoot(async (dispose) => {
        const recording = createRecording();
        await recording.loadDevices();

        expect(recording.error()).toEqual(
          expect.objectContaining({ code: "UNKNOWN_ERROR" }),
        );

        recording.clearError();

        expect(recording.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("event listeners", () => {
    it("should update level on recording:level event", () => {
      const recording = createRecording();

      const call = vi
        .mocked(listen)
        .mock.calls.find(([event]) => event === "recording:level");
      const callback = call?.[1] as
        | ((event: { payload: RecordingLevel }) => void)
        | undefined;
      expect(callback).toBeDefined();

      const levelData: RecordingLevel = {
        level: 0.5,
        peakLevel: 0.8,
      };

      callback?.({ payload: levelData });

      expect(recording.level()).toEqual(levelData);
    });

    it("should register listener at module level (singleton)", () => {
      const listenCalls = vi.mocked(listen).mock.calls.map(([event]) => event);
      expect(listenCalls).toContain("recording:level");
    });
  });
});
