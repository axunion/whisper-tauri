import {
  type AppError,
  ErrorCategory,
  ErrorCode,
  type ErrorCode as ErrorCodeType,
} from "../types/errors";

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

const MESSAGE_MAP: Record<ErrorCodeType, string> = {
  [ErrorCode.FILE_NOT_FOUND]: "ファイルが見つかりません",
  [ErrorCode.FILE_READ_ERROR]: "ファイルの読み込みに失敗しました",
  [ErrorCode.UNSUPPORTED_FORMAT]: "サポートされていないファイル形式です",
  [ErrorCode.MODEL_NOT_FOUND]: "モデルが見つかりません",
  [ErrorCode.MODEL_LOAD_ERROR]: "モデルの読み込みに失敗しました",
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: "モデルのダウンロードに失敗しました",
  [ErrorCode.TRANSCRIPTION_ERROR]: "文字起こし処理に失敗しました",
  [ErrorCode.NETWORK_ERROR]: "ネットワークエラーが発生しました",
  [ErrorCode.CANCELLED]: "処理がキャンセルされました",
  [ErrorCode.UNKNOWN_ERROR]: "予期しないエラーが発生しました",
};

export function getErrorCategory(code: ErrorCodeType): ErrorCategory {
  return CATEGORY_MAP[code];
}

export function isRecoverable(code: ErrorCodeType): boolean {
  return !NON_RECOVERABLE.has(code);
}

export function getErrorMessage(code: ErrorCodeType): string {
  return MESSAGE_MAP[code];
}

function matchErrorCode(message: string): ErrorCodeType {
  for (const [prefix, code] of PREFIX_MAP) {
    if (message.startsWith(prefix)) {
      return code;
    }
  }
  return ErrorCode.UNKNOWN_ERROR;
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
    message: getErrorMessage(code),
    recoverable: isRecoverable(code),
  };
  if (message) {
    result.details = message;
  }
  return result;
}
