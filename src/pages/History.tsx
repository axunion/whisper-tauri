import { onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  HistoryActions,
  HistoryDetail,
  HistoryFilter,
  HistoryList,
} from "~/components/history";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/Sheet";
import { createHistory } from "~/primitives/createHistory";
import type { HistoryFilter as HistoryFilterType } from "~/types";

export default function History() {
  const history = createHistory();

  onMount(() => {
    history.loadEntries();
  });

  async function handleFilterChange(filter: HistoryFilterType): Promise<void> {
    history.updateFilter(filter);
    await history.loadEntries();
  }

  async function handleDeleteSelected(): Promise<void> {
    const ids = [...history.selectedIds()];
    if (ids.length > 0) {
      await history.deleteEntries(ids);
    }
  }

  return (
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <h1 class="text-2xl font-bold">History</h1>

      <ErrorDisplay
        error={history.error()}
        onDismiss={() => history.clearError()}
      />

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle class="flex items-center justify-between">
            <span>Transcription History</span>
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <HistoryFilter
            filter={history.filter()}
            onFilterChange={handleFilterChange}
          />

          <HistoryActions
            selectedCount={history.selectedIds().size}
            totalCount={history.entries().length}
            onSelectAll={() => history.selectAll()}
            onClearSelection={() => history.clearSelection()}
            onDeleteSelected={handleDeleteSelected}
          />

          <HistoryList
            entries={history.entries()}
            selectedIds={history.selectedIds()}
            onToggleSelect={(id) => history.toggleSelect(id)}
            onViewEntry={(id) => history.getEntry(id)}
          />
        </CardContent>
      </Card>

      <Sheet
        open={!!history.selectedEntry()}
        onOpenChange={(open) => {
          if (!open) history.clearSelectedEntry();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detail</SheetTitle>
            <SheetDescription>Transcription detail view</SheetDescription>
          </SheetHeader>
          <Show when={history.selectedEntry()} keyed>
            {(entry) => <HistoryDetail entry={entry} />}
          </Show>
        </SheetContent>
      </Sheet>
    </div>
  );
}
