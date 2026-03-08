import { FiFileText, FiMic, FiMusic, FiVideo } from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
import { Checkbox } from "~/components/ui/Checkbox";
import { useI18n } from "~/i18n";
import type { HistoryMeta } from "~/types";

interface HistoryListProps {
  entries: HistoryMeta[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewEntry: (id: string) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}m ${String(seconds)}s`;
}

const VIDEO_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv"];

function hasFileExtension(fileName: string): boolean {
  return /\.\w+$/.test(fileName);
}

function getSourceIcon(fileName: string): JSX.Element {
  // Recording entries have no file extension (e.g. "Recording", "録音")
  if (!hasFileExtension(fileName)) return <FiMic class="size-4" />;
  const lower = fileName.toLowerCase();
  if (VIDEO_EXTS.some((ext) => lower.endsWith(ext)))
    return <FiVideo class="size-4" />;
  return <FiMusic class="size-4" />;
}

const HistoryList: Component<HistoryListProps> = (props) => {
  const { t, locale } = useI18n();

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(locale() === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Show
      when={props.entries.length > 0}
      fallback={
        <div class="flex min-h-48 flex-col items-center justify-center text-muted-foreground">
          <FiFileText class="mb-2 size-8" />
          <p class="text-sm">{t("history.noEntries")}</p>
        </div>
      }
    >
      <div class="min-h-48 divide-y">
        <For each={props.entries}>
          {(entry) => (
            <div class="flex items-start gap-3 px-2 py-3 hover:bg-muted/50">
              <div class="pt-0.5">
                <Checkbox
                  checked={props.selectedIds.has(entry.id)}
                  onChange={() => props.onToggleSelect(entry.id)}
                  colorScheme="neutral"
                />
              </div>
              <button
                type="button"
                class="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left"
                onClick={() => props.onViewEntry(entry.id)}
              >
                <div class="flex items-center gap-2">
                  <span class="shrink-0 text-muted-foreground">
                    {getSourceIcon(entry.fileName)}
                  </span>
                  <span class="truncate text-sm font-medium">
                    {entry.fileName}
                  </span>
                </div>
                <p class="truncate text-xs text-muted-foreground">
                  {entry.textPreview}
                </p>
                <div class="flex gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(entry.createdAt)}</span>
                  <span>{formatDuration(entry.duration)}</span>
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
