import type { IpcError } from "~/bindings";
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
  [ErrorCode.INFERENCE_ERROR]: ErrorCategory.PROCESS,
  [ErrorCode.NETWORK_ERROR]: ErrorCategory.NETWORK,
  [ErrorCode.CANCELLED]: ErrorCategory.CANCELLED,
  [ErrorCode.UNKNOWN_ERROR]: ErrorCategory.UNKNOWN,
};

const NON_RECOVERABLE: ReadonlySet<ErrorCodeType> = new Set([
  ErrorCode.MODEL_LOAD_ERROR,
  ErrorCode.CANCELLED,
]);

const MESSAGE_KEY_MAP: Record<ErrorCodeType, DictionaryKey> = {
  [ErrorCode.FILE_NOT_FOUND]: "errors.fileNotFound",
  [ErrorCode.FILE_READ_ERROR]: "errors.fileReadError",
  [ErrorCode.UNSUPPORTED_FORMAT]: "errors.unsupportedFormat",
  [ErrorCode.MODEL_NOT_FOUND]: "errors.modelNotFound",
  [ErrorCode.MODEL_LOAD_ERROR]: "errors.modelLoadError",
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: "errors.modelDownloadError",
  [ErrorCode.TRANSCRIPTION_ERROR]: "errors.transcriptionError",
  [ErrorCode.INFERENCE_ERROR]: "errors.inferenceError",
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

function isIpcError(error: unknown): error is IpcError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code in CATEGORY_MAP &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/**
 * Turns whatever a failed call rejected with into an `AppError`.
 *
 * Commands reject with the backend's `IpcError`, which carries its own code.
 * Anything else — Tauri's own string rejections (a denied permission, an
 * unknown command), a JS `Error` — has no classification.
 */
export function parseError(error: unknown): AppError {
  let code: ErrorCodeType = ErrorCode.UNKNOWN_ERROR;
  let message: string;

  if (isIpcError(error)) {
    code = error.code;
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error == null) {
    message = "";
  } else {
    message = String(error);
  }

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
