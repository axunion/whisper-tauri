import { Show } from "solid-js";
import type { AppError } from "~/types/errors";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

const CATEGORY_LABELS: Record<string, string> = {
  file: "ファイル",
  model: "モデル",
  process: "処理",
  network: "ネットワーク",
  cancelled: "キャンセル",
  unknown: "エラー",
};

interface ErrorDisplayProps {
  error: AppError | null;
  onDismiss: () => void;
  onRetry?: (() => void) | undefined;
}

export function ErrorDisplay(props: ErrorDisplayProps) {
  return (
    <Show when={props.error}>
      {(error) => (
        <div class="rounded-lg border border-destructive bg-destructive/10 p-4 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <Badge
                variant="outline"
                class="border-destructive text-destructive"
              >
                {CATEGORY_LABELS[error().category] ?? "エラー"}
              </Badge>
              <span class="text-sm font-medium text-destructive">
                {error().message}
              </span>
            </div>
            <div class="flex shrink-0 gap-1">
              <Show when={error().recoverable && props.onRetry}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => props.onRetry?.()}
                  aria-label="再試行"
                >
                  再試行
                </Button>
              </Show>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.onDismiss()}
                aria-label="閉じる"
              >
                閉じる
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
