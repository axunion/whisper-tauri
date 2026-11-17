import { A, useNavigate } from "@solidjs/router";
import { FiChevronRight, FiClock } from "solid-icons/fi";
import { For, onMount, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import { formatDateShort, formatDuration } from "~/lib/format";
import { createHistory } from "~/primitives/createHistory";

export function RecentActivity() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const history = createHistory();

  onMount(() => {
    history.updateFilter({ limit: 7 });
  });

  return (
    <Show when={history.entries().length > 0}>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          <Button as={A} href="/history" variant="ghost" size="sm">
            {t("dashboard.viewAll")}
            <FiChevronRight />
          </Button>
        </CardHeader>
        <CardContent>
          <div class="divide-y divide-border/50">
            <For each={history.entries()}>
              {(entry) => (
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center gap-3 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    navigate("/history", { state: { entryId: entry.id } })
                  }
                >
                  <div class="flex shrink-0 flex-col items-start text-[11px] text-muted-foreground">
                    <span>{formatDateShort(entry.createdAt, locale())}</span>
                    <span class="inline-flex items-center gap-0.5">
                      <FiClock class="size-2.5" />
                      {formatDuration(entry.duration)}
                    </span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium">{entry.fileName}</div>
                    <div class="mt-0.5 truncate text-xs text-muted-foreground">
                      {entry.textPreview}
                    </div>
                  </div>
                </button>
              )}
            </For>
          </div>
        </CardContent>
      </Card>
    </Show>
  );
}
