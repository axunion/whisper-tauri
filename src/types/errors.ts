import type { DictionaryKey } from "~/i18n/types";

export const ErrorCategory = {
  FILE: "file",
  MODEL: "model",
  PROCESS: "process",
  NETWORK: "network",
  CANCELLED: "cancelled",
  UNKNOWN: "unknown",
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

export const ErrorCode = {
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  MODEL_LOAD_ERROR: "MODEL_LOAD_ERROR",
  MODEL_DOWNLOAD_ERROR: "MODEL_DOWNLOAD_ERROR",
  TRANSCRIPTION_ERROR: "TRANSCRIPTION_ERROR",
  INFERENCE_ERROR: "INFERENCE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  CANCELLED: "CANCELLED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface AppError {
  code: ErrorCode;
  category: ErrorCategory;
  messageKey: DictionaryKey;
  details?: string;
  recoverable: boolean;
}
