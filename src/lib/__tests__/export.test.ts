import { describe, expect, it } from "vitest";
import type { TranscriptionResult } from "../../types/whisper";
import {
  exportResult,
  formatTimestamp,
  getExtension,
  toSRT,
  toTXT,
  toVTT,
} from "../export";

const sampleResult: TranscriptionResult = {
  taskId: "test-task",
  text: "Hello world. This is a test.",
  segments: [
    { start: 0, end: 2500, text: "Hello world." },
    { start: 2500, end: 5000, text: " This is a test." },
  ],
  language: "en",
  duration: 5000,
};

describe("formatTimestamp", () => {
  it("should format milliseconds to SRT timestamp (comma separator)", () => {
    expect(formatTimestamp(0, "srt")).toBe("00:00:00,000");
    expect(formatTimestamp(1500, "srt")).toBe("00:00:01,500");
    expect(formatTimestamp(3723456, "srt")).toBe("01:02:03,456");
  });

  it("should format milliseconds to VTT timestamp (dot separator)", () => {
    expect(formatTimestamp(0, "vtt")).toBe("00:00:00.000");
    expect(formatTimestamp(1500, "vtt")).toBe("00:00:01.500");
    expect(formatTimestamp(3723456, "vtt")).toBe("01:02:03.456");
  });
});

describe("toTXT", () => {
  it("should return plain text", () => {
    expect(toTXT(sampleResult)).toBe("Hello world. This is a test.");
  });
});

describe("toSRT", () => {
  it("should format as valid SRT with index and comma timestamps", () => {
    const result = toSRT(sampleResult);
    const expected = [
      "1",
      "00:00:00,000 --> 00:00:02,500",
      "Hello world.",
      "",
      "2",
      "00:00:02,500 --> 00:00:05,000",
      "This is a test.",
      "",
    ].join("\n");
    expect(result).toBe(expected);
  });
});

describe("toVTT", () => {
  it("should format as valid VTT with WEBVTT header and dot timestamps", () => {
    const result = toVTT(sampleResult);
    const expected = [
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:02.500",
      "Hello world.",
      "",
      "00:00:02.500 --> 00:00:05.000",
      "This is a test.",
      "",
    ].join("\n");
    expect(result).toBe(expected);
  });
});

describe("exportResult", () => {
  it("should export as TXT", () => {
    expect(exportResult(sampleResult, "txt")).toBe(toTXT(sampleResult));
  });

  it("should export as SRT", () => {
    expect(exportResult(sampleResult, "srt")).toBe(toSRT(sampleResult));
  });

  it("should export as VTT", () => {
    expect(exportResult(sampleResult, "vtt")).toBe(toVTT(sampleResult));
  });
});

describe("getExtension", () => {
  it("should return correct extension for each format", () => {
    expect(getExtension("txt")).toBe(".txt");
    expect(getExtension("srt")).toBe(".srt");
    expect(getExtension("vtt")).toBe(".vtt");
  });
});
