import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../types/errors";
import {
  getErrorCategory,
  getErrorMessage,
  isRecoverable,
  parseError,
} from "../errors";

describe("getErrorCategory", () => {
  it("should return 'file' for FILE_NOT_FOUND", () => {
    expect(getErrorCategory(ErrorCode.FILE_NOT_FOUND)).toBe("file");
  });

  it("should return 'file' for FILE_READ_ERROR", () => {
    expect(getErrorCategory(ErrorCode.FILE_READ_ERROR)).toBe("file");
  });

  it("should return 'file' for UNSUPPORTED_FORMAT", () => {
    expect(getErrorCategory(ErrorCode.UNSUPPORTED_FORMAT)).toBe("file");
  });

  it("should return 'model' for MODEL_NOT_FOUND", () => {
    expect(getErrorCategory(ErrorCode.MODEL_NOT_FOUND)).toBe("model");
  });

  it("should return 'model' for MODEL_LOAD_ERROR", () => {
    expect(getErrorCategory(ErrorCode.MODEL_LOAD_ERROR)).toBe("model");
  });

  it("should return 'model' for MODEL_DOWNLOAD_ERROR", () => {
    expect(getErrorCategory(ErrorCode.MODEL_DOWNLOAD_ERROR)).toBe("model");
  });

  it("should return 'process' for TRANSCRIPTION_ERROR", () => {
    expect(getErrorCategory(ErrorCode.TRANSCRIPTION_ERROR)).toBe("process");
  });

  it("should return 'network' for NETWORK_ERROR", () => {
    expect(getErrorCategory(ErrorCode.NETWORK_ERROR)).toBe("network");
  });

  it("should return 'cancelled' for CANCELLED", () => {
    expect(getErrorCategory(ErrorCode.CANCELLED)).toBe("cancelled");
  });

  it("should return 'unknown' for UNKNOWN_ERROR", () => {
    expect(getErrorCategory(ErrorCode.UNKNOWN_ERROR)).toBe("unknown");
  });
});

describe("isRecoverable", () => {
  it("should return false for MODEL_LOAD_ERROR", () => {
    expect(isRecoverable(ErrorCode.MODEL_LOAD_ERROR)).toBe(false);
  });

  it("should return false for CANCELLED", () => {
    expect(isRecoverable(ErrorCode.CANCELLED)).toBe(false);
  });

  it("should return true for FILE_NOT_FOUND", () => {
    expect(isRecoverable(ErrorCode.FILE_NOT_FOUND)).toBe(true);
  });

  it("should return true for NETWORK_ERROR", () => {
    expect(isRecoverable(ErrorCode.NETWORK_ERROR)).toBe(true);
  });

  it("should return true for MODEL_DOWNLOAD_ERROR", () => {
    expect(isRecoverable(ErrorCode.MODEL_DOWNLOAD_ERROR)).toBe(true);
  });

  it("should return true for TRANSCRIPTION_ERROR", () => {
    expect(isRecoverable(ErrorCode.TRANSCRIPTION_ERROR)).toBe(true);
  });

  it("should return true for UNKNOWN_ERROR", () => {
    expect(isRecoverable(ErrorCode.UNKNOWN_ERROR)).toBe(true);
  });
});

describe("parseError", () => {
  it("should parse 'File not found:' prefix to FILE_NOT_FOUND", () => {
    const result = parseError("File not found: /path/to/file.wav");
    expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(result.details).toBe("File not found: /path/to/file.wav");
  });

  it("should parse 'File read error:' prefix to FILE_READ_ERROR", () => {
    const result = parseError("File read error: corrupt data");
    expect(result.code).toBe(ErrorCode.FILE_READ_ERROR);
    expect(result.details).toBe("File read error: corrupt data");
  });

  it("should parse 'IO error:' prefix to FILE_READ_ERROR", () => {
    const result = parseError("IO error: permission denied");
    expect(result.code).toBe(ErrorCode.FILE_READ_ERROR);
    expect(result.details).toBe("IO error: permission denied");
  });

  it("should parse 'Unsupported format:' prefix to UNSUPPORTED_FORMAT", () => {
    const result = parseError("Unsupported format: mp3");
    expect(result.code).toBe(ErrorCode.UNSUPPORTED_FORMAT);
    expect(result.details).toBe("Unsupported format: mp3");
  });

  it("should parse 'Model not found:' prefix to MODEL_NOT_FOUND", () => {
    const result = parseError("Model not found: nonexistent");
    expect(result.code).toBe(ErrorCode.MODEL_NOT_FOUND);
    expect(result.details).toBe("Model not found: nonexistent");
  });

  it("should parse 'Model load error:' prefix to MODEL_LOAD_ERROR", () => {
    const result = parseError("Model load error: invalid format");
    expect(result.code).toBe(ErrorCode.MODEL_LOAD_ERROR);
    expect(result.details).toBe("Model load error: invalid format");
  });

  it("should parse 'Download failed:' prefix to MODEL_DOWNLOAD_ERROR", () => {
    const result = parseError("Download failed: timeout");
    expect(result.code).toBe(ErrorCode.MODEL_DOWNLOAD_ERROR);
    expect(result.details).toBe("Download failed: timeout");
  });

  it("should parse 'Transcription error:' prefix to TRANSCRIPTION_ERROR", () => {
    const result = parseError("Transcription error: decode failed");
    expect(result.code).toBe(ErrorCode.TRANSCRIPTION_ERROR);
    expect(result.details).toBe("Transcription error: decode failed");
  });

  it("should parse 'Conversion failed:' prefix to TRANSCRIPTION_ERROR", () => {
    const result = parseError("Conversion failed: exit code 1");
    expect(result.code).toBe(ErrorCode.TRANSCRIPTION_ERROR);
    expect(result.details).toBe("Conversion failed: exit code 1");
  });

  it("should parse 'HTTP error:' prefix to NETWORK_ERROR", () => {
    const result = parseError("HTTP error: 500");
    expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(result.details).toBe("HTTP error: 500");
  });

  it("should parse 'FFmpeg not found:' prefix to FILE_NOT_FOUND", () => {
    const result = parseError("FFmpeg not found: not installed");
    expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(result.details).toBe("FFmpeg not found: not installed");
  });

  it("should parse 'Transcription cancelled' to CANCELLED", () => {
    const result = parseError("Transcription cancelled");
    expect(result.code).toBe(ErrorCode.CANCELLED);
    expect(result.details).toBe("Transcription cancelled");
  });

  it("should parse Error object using its message", () => {
    const result = parseError(new Error("Model not found: test-model"));
    expect(result.code).toBe(ErrorCode.MODEL_NOT_FOUND);
    expect(result.details).toBe("Model not found: test-model");
  });

  it("should parse unknown type to UNKNOWN_ERROR", () => {
    const result = parseError(42);
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.details).toBe("42");
  });

  it("should parse null/undefined to UNKNOWN_ERROR", () => {
    const result = parseError(null);
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it("should parse unrecognized string to UNKNOWN_ERROR", () => {
    const result = parseError("Something went wrong");
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.details).toBe("Something went wrong");
  });

  it("should include correct category and recoverable fields", () => {
    const result = parseError("Model load error: invalid");
    expect(result.category).toBe("model");
    expect(result.recoverable).toBe(false);
  });

  it("should set user-friendly message", () => {
    const result = parseError("File not found: /path/to/file.wav");
    expect(result.message).toBe(getErrorMessage(ErrorCode.FILE_NOT_FOUND));
  });
});

describe("getErrorMessage", () => {
  it("should return Japanese message for FILE_NOT_FOUND", () => {
    const msg = getErrorMessage(ErrorCode.FILE_NOT_FOUND);
    expect(msg).toContain("ファイルが見つかりません");
  });

  it("should return Japanese message for FILE_READ_ERROR", () => {
    const msg = getErrorMessage(ErrorCode.FILE_READ_ERROR);
    expect(msg).toContain("ファイルの読み込み");
  });

  it("should return Japanese message for UNSUPPORTED_FORMAT", () => {
    const msg = getErrorMessage(ErrorCode.UNSUPPORTED_FORMAT);
    expect(msg).toContain("サポートされていない");
  });

  it("should return Japanese message for MODEL_NOT_FOUND", () => {
    const msg = getErrorMessage(ErrorCode.MODEL_NOT_FOUND);
    expect(msg).toContain("モデルが見つかりません");
  });

  it("should return Japanese message for MODEL_LOAD_ERROR", () => {
    const msg = getErrorMessage(ErrorCode.MODEL_LOAD_ERROR);
    expect(msg).toContain("モデルの読み込み");
  });

  it("should return Japanese message for MODEL_DOWNLOAD_ERROR", () => {
    const msg = getErrorMessage(ErrorCode.MODEL_DOWNLOAD_ERROR);
    expect(msg).toContain("ダウンロード");
  });

  it("should return Japanese message for TRANSCRIPTION_ERROR", () => {
    const msg = getErrorMessage(ErrorCode.TRANSCRIPTION_ERROR);
    expect(msg).toContain("文字起こし");
  });

  it("should return Japanese message for NETWORK_ERROR", () => {
    const msg = getErrorMessage(ErrorCode.NETWORK_ERROR);
    expect(msg).toContain("ネットワーク");
  });

  it("should return Japanese message for CANCELLED", () => {
    const msg = getErrorMessage(ErrorCode.CANCELLED);
    expect(msg).toContain("キャンセル");
  });

  it("should return Japanese message for UNKNOWN_ERROR", () => {
    const msg = getErrorMessage(ErrorCode.UNKNOWN_ERROR);
    expect(msg).toContain("エラー");
  });
});
