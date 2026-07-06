import { fireEvent, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { ja } from "~/i18n/dictionaries/ja";
import { renderWithI18n } from "~/test/helpers";
import type { AppError } from "~/types/errors";
import { ErrorCode } from "~/types/errors";
import { getErrorCategory, isRecoverable } from "../../lib/errors";
import { ErrorDisplay } from "../ErrorDisplay";

function makeError(overrides?: Partial<AppError>): AppError {
  return {
    code: ErrorCode.FILE_NOT_FOUND,
    category: getErrorCategory(ErrorCode.FILE_NOT_FOUND),
    messageKey: "errors.fileNotFound",
    recoverable: isRecoverable(ErrorCode.FILE_NOT_FOUND),
    ...overrides,
  };
}

describe("ErrorDisplay", () => {
  describe("render", () => {
    it("should display error message", () => {
      const error = makeError();
      renderWithI18n(() => <ErrorDisplay error={error} onDismiss={() => {}} />);
      expect(screen.getByText(ja.errors.fileNotFound)).toBeInTheDocument();
    });

    it("should display details when present", () => {
      const details = "File not found: /path/to/file.wav";
      const error = makeError({ details });
      renderWithI18n(() => <ErrorDisplay error={error} onDismiss={() => {}} />);
      expect(screen.getByText(details)).toBeInTheDocument();
    });

    it("should not display details section when details is absent", () => {
      const error = makeError();
      delete error.details;
      renderWithI18n(() => <ErrorDisplay error={error} onDismiss={() => {}} />);
      expect(screen.queryByText("File not found:")).not.toBeInTheDocument();
    });

    it("should render nothing when error is null", () => {
      const { container } = renderWithI18n(() => (
        <ErrorDisplay error={null} onDismiss={() => {}} />
      ));
      expect(container.querySelector("[class*='rounded-lg']")).toBeNull();
    });
  });

  describe("onDismiss", () => {
    it("should call onDismiss when close button is clicked", () => {
      const onDismiss = vi.fn();
      const error = makeError();
      renderWithI18n(() => (
        <ErrorDisplay error={error} onDismiss={onDismiss} />
      ));
      const closeButton = screen.getByRole("button", {
        name: ja.common.close,
      });
      fireEvent.click(closeButton);
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  describe("onRetry", () => {
    it("should show retry button when recoverable and onRetry provided", () => {
      const onRetry = vi.fn();
      const error = makeError({ recoverable: true });
      renderWithI18n(() => (
        <ErrorDisplay error={error} onDismiss={() => {}} onRetry={onRetry} />
      ));
      const retryButton = screen.getByRole("button", {
        name: ja.common.retry,
      });
      expect(retryButton).toBeInTheDocument();
    });

    it("should call onRetry when retry button is clicked", () => {
      const onRetry = vi.fn();
      const error = makeError({ recoverable: true });
      renderWithI18n(() => (
        <ErrorDisplay error={error} onDismiss={() => {}} onRetry={onRetry} />
      ));
      const retryButton = screen.getByRole("button", {
        name: ja.common.retry,
      });
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("should not show retry button when recoverable is false", () => {
      const onRetry = vi.fn();
      const error = makeError({ recoverable: false });
      renderWithI18n(() => (
        <ErrorDisplay error={error} onDismiss={() => {}} onRetry={onRetry} />
      ));
      expect(
        screen.queryByRole("button", { name: ja.common.retry }),
      ).not.toBeInTheDocument();
    });

    it("should not show retry button when onRetry is not provided", () => {
      const error = makeError({ recoverable: true });
      renderWithI18n(() => <ErrorDisplay error={error} onDismiss={() => {}} />);
      expect(
        screen.queryByRole("button", { name: ja.common.retry }),
      ).not.toBeInTheDocument();
    });
  });
});
