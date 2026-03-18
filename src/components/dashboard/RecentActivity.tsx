import { A } from "@solidjs/router";
import { FiChevronRight } from "solid-icons/fi";
import { For, onMount, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import { formatDuration } from "~/lib/format";
import { createHistory } from "~/primitives/createHistory";

export function RecentActivity() {
  const { t } = useI18n();
  const history = createHistory();

  onMount(() => {
    history.updateFilter({ limit: 3 });
    history.loadEntries();
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
                <div class="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span class="truncate font-medium">{entry.fileName}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {formatDuration(entry.duration)}
                  </span>
                </div>
              )}
            </For>
          </div>
        </CardContent>
      </Card>
    </Show>
  );
}
