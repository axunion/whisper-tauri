import { A } from "@solidjs/router";
import { For, onMount, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { createHistory } from "~/primitives/createHistory";

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentHistory() {
  const history = createHistory();

  onMount(() => {
    history.loadEntries();
  });

  const recentEntries = () => history.entries().slice(0, 5);

  return (
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Recent History</CardTitle>
        <Show when={history.entries().length > 0}>
          <Button as={A} href="/history" variant="ghost" size="sm">
            View All
          </Button>
        </Show>
      </CardHeader>
      <CardContent>
        <Show
          when={recentEntries().length > 0}
          fallback={
            <p class="text-sm text-muted-foreground">
              No transcription history yet.
            </p>
          }
        >
          <div class="divide-y">
            <For each={recentEntries()}>
              {(entry) => (
                <A
                  href="/history"
                  class="flex items-center justify-between py-2 text-sm hover:bg-muted/50"
                >
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <span class="truncate font-medium">{entry.fileName}</span>
                    <Badge variant="secondary" class="shrink-0 text-xs">
                      {entry.language}
                    </Badge>
                  </div>
                  <span class="ml-2 shrink-0 text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                </A>
              )}
            </For>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}
