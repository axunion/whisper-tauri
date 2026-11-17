import { describe, expect, it } from "vitest";
import { ErrorCode } from "~/types/errors";
import { getErrorCategory, isRecoverable, parseError } from "../errors";

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
  it("keeps the code from an IpcError rejection and exposes its message as details", () => {
    const result = parseError({
      code: "FILE_NOT_FOUND",
      message: "File not found: /path/to/file.wav",
    });
    expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(result.details).toBe("File not found: /path/to/file.wav");
  });

  it("sets category, messageKey and recoverable from the IpcError code", () => {
    const result = parseError({
      code: "MODEL_LOAD_ERROR",
      message: "Model load error: invalid format",
    });
    expect(result.category).toBe("model");
    expect(result.messageKey).toBe("errors.modelLoadError");
    expect(result.recoverable).toBe(false);
  });

  it("marks a CANCELLED IpcError as non-recoverable", () => {
    const result = parseError({
      code: "CANCELLED",
      message: "Transcription cancelled",
    });
    expect(result.code).toBe(ErrorCode.CANCELLED);
    expect(result.category).toBe("cancelled");
    expect(result.recoverable).toBe(false);
  });

  it("omits details when the IpcError message is empty", () => {
    const result = parseError({ code: "NETWORK_ERROR", message: "" });
    expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(result).not.toHaveProperty("details");
  });

  it("maps a plain string to UNKNOWN_ERROR and keeps the text as details", () => {
    const result = parseError("File not found: /path/to/file.wav");
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.details).toBe("File not found: /path/to/file.wav");
  });

  it("maps an Error to UNKNOWN_ERROR and keeps its message as details", () => {
    const result = parseError(new Error("Model not found: test-model"));
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.details).toBe("Model not found: test-model");
  });

  it("maps an unrecognised numeric value to UNKNOWN_ERROR", () => {
    const result = parseError(42);
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.details).toBe("42");
  });

  it("maps null and undefined to UNKNOWN_ERROR without details", () => {
    expect(parseError(null).code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(parseError(null)).not.toHaveProperty("details");
    expect(parseError(undefined).code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(parseError(undefined)).not.toHaveProperty("details");
  });

  it("maps an arbitrary object without a code to UNKNOWN_ERROR", () => {
    const result = parseError({ message: "something", extra: true });
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it("maps an object with an unrecognised code to UNKNOWN_ERROR", () => {
    const result = parseError({ code: "NOT_A_REAL_CODE", message: "boom" });
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it("does not classify a string by its prefix", () => {
    const result = parseError("Transcription cancelled");
    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.details).toBe("Transcription cancelled");
  });
});
