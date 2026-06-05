import type { DictionaryKey } from "~/i18n/types";
import {
  type AppError,
  ErrorCategory,
  ErrorCode,
  type ErrorCode as ErrorCodeType,
} from "~/types/errors";

const CATEGORY_MAP: Record<ErrorCodeType, ErrorCategory> = {
  [ErrorCode.FILE_NOT_FOUND]: ErrorCategory.FILE,
  [ErrorCode.FILE_READ_ERROR]: ErrorCategory.FILE,
  [ErrorCode.UNSUPPORTED_FORMAT]: ErrorCategory.FILE,
  [ErrorCode.MODEL_NOT_FOUND]: ErrorCategory.MODEL,
  [ErrorCode.MODEL_LOAD_ERROR]: ErrorCategory.MODEL,
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: ErrorCategory.MODEL,
  [ErrorCode.TRANSCRIPTION_ERROR]: ErrorCategory.PROCESS,
  [ErrorCode.NETWORK_ERROR]: ErrorCategory.NETWORK,
  [ErrorCode.CANCELLED]: ErrorCategory.CANCELLED,
  [ErrorCode.UNKNOWN_ERROR]: ErrorCategory.UNKNOWN,
};

const NON_RECOVERABLE: ReadonlySet<ErrorCodeType> = new Set([
  ErrorCode.MODEL_LOAD_ERROR,
  ErrorCode.CANCELLED,
]);

const PREFIX_MAP: readonly [string, ErrorCodeType][] = [
  ["File not found:", ErrorCode.FILE_NOT_FOUND],
  ["File read error:", ErrorCode.FILE_READ_ERROR],
  ["IO error:", ErrorCode.FILE_READ_ERROR],
  ["Unsupported format:", ErrorCode.UNSUPPORTED_FORMAT],
  ["Model not found:", ErrorCode.MODEL_NOT_FOUND],
  ["Model load error:", ErrorCode.MODEL_LOAD_ERROR],
  ["Download failed:", ErrorCode.MODEL_DOWNLOAD_ERROR],
  ["Transcription error:", ErrorCode.TRANSCRIPTION_ERROR],
  ["Conversion failed:", ErrorCode.TRANSCRIPTION_ERROR],
  ["HTTP error:", ErrorCode.NETWORK_ERROR],
  ["Notion API error", ErrorCode.NETWORK_ERROR],
  ["Invalid response from Notion API", ErrorCode.NETWORK_ERROR],
  ["Server start failed:", ErrorCode.NETWORK_ERROR],
  ["Server not running", ErrorCode.NETWORK_ERROR],
  ["Inference error:", ErrorCode.TRANSCRIPTION_ERROR],
  ["Inference cancelled", ErrorCode.CANCELLED],
  ["FFmpeg not found:", ErrorCode.FILE_NOT_FOUND],
  ["Transcription cancelled", ErrorCode.CANCELLED],
  ["Database error:", ErrorCode.UNKNOWN_ERROR],
  ["History not found:", ErrorCode.FILE_NOT_FOUND],
  ["Compression error:", ErrorCode.UNKNOWN_ERROR],
];

const MESSAGE_KEY_MAP: Record<ErrorCodeType, DictionaryKey> = {
  [ErrorCode.FILE_NOT_FOUND]: "errors.fileNotFound",
  [ErrorCode.FILE_READ_ERROR]: "errors.fileReadError",
  [ErrorCode.UNSUPPORTED_FORMAT]: "errors.unsupportedFormat",
  [ErrorCode.MODEL_NOT_FOUND]: "errors.modelNotFound",
  [ErrorCode.MODEL_LOAD_ERROR]: "errors.modelLoadError",
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: "errors.modelDownloadError",
  [ErrorCode.TRANSCRIPTION_ERROR]: "errors.transcriptionError",
  [ErrorCode.NETWORK_ERROR]: "errors.networkError",
  [ErrorCode.CANCELLED]: "errors.processCancelled",
  [ErrorCode.UNKNOWN_ERROR]: "errors.unknownError",
};

export function getErrorCategory(code: ErrorCodeType): ErrorCategory {
  return CATEGORY_MAP[code];
}

export function isRecoverable(code: ErrorCodeType): boolean {
  return !NON_RECOVERABLE.has(code);
}

function matchErrorCode(message: string): ErrorCodeType {
  for (const [prefix, code] of PREFIX_MAP) {
    if (message.startsWith(prefix)) {
      return code;
    }
  }
  return ErrorCode.UNKNOWN_ERROR;
}

export interface ErrorProvider {
  error: () => AppError | null;
  clearError: () => void;
}

export interface CombinedErrorProvider {
  error: () => AppError | null;
  clearAll: () => void;
}

/**
 * Combines multiple error providers: exposes the first non-null error and
 * a `clearAll` that clears every provider at once.
 */
export function combineErrorProviders(
  providers: readonly ErrorProvider[],
): CombinedErrorProvider {
  return {
    error: () => {
      for (const p of providers) {
        const e = p.error();
        if (e) return e;
      }
      return null;
    },
    clearAll: () => {
      for (const p of providers) p.clearError();
    },
  };
}

export function parseError(error: unknown): AppError {
  let message: string;

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error == null) {
    message = "";
  } else {
    message = String(error);
  }

  const code = matchErrorCode(message);
  const result: AppError = {
    code,
    category: getErrorCategory(code),
    messageKey: MESSAGE_KEY_MAP[code],
    recoverable: isRecoverable(code),
  };
  if (message) {
    result.details = message;
  }
  return result;
}
