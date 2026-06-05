import { FiRefreshCw, FiX } from "solid-icons/fi";
import { Show } from "solid-js";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import type { AppError } from "~/types/errors";
import { ErrorCategory } from "~/types/errors";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

const CATEGORY_KEYS: Record<ErrorCategory, DictionaryKey> = {
  [ErrorCategory.FILE]: "errors.file",
  [ErrorCategory.MODEL]: "errors.model",
  [ErrorCategory.PROCESS]: "errors.process",
  [ErrorCategory.NETWORK]: "errors.network",
  [ErrorCategory.CANCELLED]: "errors.cancelled",
  [ErrorCategory.UNKNOWN]: "errors.unknown",
};

interface ErrorDisplayProps {
  error: AppError | null;
  onDismiss: () => void;
  onRetry?: (() => void) | undefined;
}

export function ErrorDisplay(props: ErrorDisplayProps) {
  const { t } = useI18n();

  return (
    <Show when={props.error}>
      {(error) => (
        <div
          role="alert"
          class="rounded-lg border border-destructive bg-destructive/10 p-4 space-y-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <Badge
                variant="outline"
                class="border-destructive text-destructive"
              >
                {t(CATEGORY_KEYS[error().category])}
              </Badge>
              <span class="text-sm font-medium text-destructive">
                {t(error().messageKey)}
              </span>
            </div>
            <div class="flex shrink-0 gap-1">
              <Show when={error().recoverable && props.onRetry}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => props.onRetry?.()}
                  aria-label={t("common.retry")}
                >
                  <FiRefreshCw />
                  {t("common.retry")}
                </Button>
              </Show>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.onDismiss()}
                aria-label={t("common.close")}
              >
                <FiX />
                {t("common.close")}
              </Button>
            </div>
          </div>
          <Show when={error().details}>
            <p class="text-xs text-muted-foreground">{error().details}</p>
          </Show>
        </div>
      )}
    </Show>
  );
}
