import { FiFileText } from "solid-icons/fi";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Checkbox } from "~/components/ui/Checkbox";
import type { HistoryMeta } from "~/types";

interface HistoryListProps {
  entries: HistoryMeta[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewEntry: (id: string) => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}m ${String(seconds)}s`;
}

const HistoryList: Component<HistoryListProps> = (props) => {
  return (
    <Show
      when={props.entries.length > 0}
      fallback={
        <div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FiFileText class="mb-2 size-8" />
          <p class="text-sm">No history entries found.</p>
        </div>
      }
    >
      <div class="divide-y">
        <For each={props.entries}>
          {(entry) => (
            <div class="flex items-start gap-3 px-2 py-3 hover:bg-muted/50">
              <div class="pt-0.5">
                <Checkbox
                  checked={props.selectedIds.has(entry.id)}
                  onChange={() => props.onToggleSelect(entry.id)}
                />
              </div>
              <button
                type="button"
                class="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left"
                onClick={() => props.onViewEntry(entry.id)}
              >
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">
                    {entry.fileName}
                  </span>
                  <Badge variant="secondary" class="shrink-0 text-xs">
                    {entry.language}
                  </Badge>
                </div>
                <p class="truncate text-xs text-muted-foreground">
                  {entry.textPreview}
                </p>
                <div class="flex gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(entry.createdAt)}</span>
                  <span>{formatDuration(entry.duration)}</span>
                  <span>{entry.modelId}</span>
                </div>
              </button>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

export { HistoryList };
