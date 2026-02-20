import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { ConversionResult, SupportedFormat } from "../../types";
import { createFileConverter } from "../createFileConverter";

describe("createFileConverter", () => {
  describe("initial state", () => {
    it("should have isConverting as false", () => {
      createRoot((dispose) => {
        const converter = createFileConverter();
        expect(converter.isConverting()).toBe(false);
        dispose();
      });
    });

    it("should have null error", () => {
      createRoot((dispose) => {
        const converter = createFileConverter();
        expect(converter.error()).toBeNull();
        dispose();
      });
    });
  });

  describe("convert", () => {
    it("should invoke convert_audio_file and return result", async () => {
      const mockResult: ConversionResult = {
        outputPath: "/tmp/audio_converted.wav",
        originalPath: "/path/to/audio.mp3",
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      await createRoot(async (dispose) => {
        const converter = createFileConverter();
        const result = await converter.convert("/path/to/audio.mp3");

        expect(invoke).toHaveBeenCalledWith("convert_audio_file", {
          inputPath: "/path/to/audio.mp3",
        });
        expect(result).toEqual(mockResult);
        dispose();
      });
    });

    it("should manage isConverting flag", async () => {
      let resolveConvert: (value: ConversionResult) => void = () => {};
      const convertPromise = new Promise<ConversionResult>((resolve) => {
        resolveConvert = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(convertPromise as Promise<unknown>);

      await createRoot(async (dispose) => {
        const converter = createFileConverter();

        expect(converter.isConverting()).toBe(false);

        const promise = converter.convert("/path/to/audio.mp3");

        expect(converter.isConverting()).toBe(true);

        resolveConvert({
          outputPath: "/tmp/output.wav",
          originalPath: "/path/to/audio.mp3",
        });
        await promise;

        expect(converter.isConverting()).toBe(false);
        dispose();
      });
    });

    it("should set error on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Conversion failed"));

      await createRoot(async (dispose) => {
        const converter = createFileConverter();
        const result = await converter.convert("/path/to/audio.mp3");

        expect(converter.error()).toBe("Conversion failed");
        expect(result).toBeNull();
        dispose();
      });
    });
  });

  describe("getSupportedFormats", () => {
    it("should invoke get_supported_formats", async () => {
      const mockFormats: SupportedFormat[] = [
        { extension: "wav", description: "WAV Audio", needsConversion: false },
        { extension: "mp3", description: "MP3 Audio", needsConversion: true },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(mockFormats);

      await createRoot(async (dispose) => {
        const converter = createFileConverter();
        const formats = await converter.getSupportedFormats();

        expect(invoke).toHaveBeenCalledWith("get_supported_formats");
        expect(formats).toEqual(mockFormats);
        dispose();
      });
    });
  });

  describe("cleanup", () => {
    it("should invoke cleanup_converted_file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await createRoot(async (dispose) => {
        const converter = createFileConverter();
        await converter.cleanup("/tmp/audio_converted.wav");

        expect(invoke).toHaveBeenCalledWith("cleanup_converted_file", {
          filePath: "/tmp/audio_converted.wav",
        });
        dispose();
      });
    });

    it("should not throw on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Cleanup failed"));

      await createRoot(async (dispose) => {
        const converter = createFileConverter();
        // Should not throw
        await converter.cleanup("/tmp/audio_converted.wav");
        dispose();
      });
    });
  });

  describe("clearError", () => {
    it("should set error to null", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Some error"));

      await createRoot(async (dispose) => {
        const converter = createFileConverter();
        await converter.convert("/path/to/audio.mp3");

        expect(converter.error()).toBe("Some error");

        converter.clearError();

        expect(converter.error()).toBeNull();
        dispose();
      });
    });
  });
});
