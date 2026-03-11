import { FiFileText, FiMic, FiMusic, FiVideo } from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
import { Checkbox } from "~/components/ui/Checkbox";
import { useI18n } from "~/i18n";
import type { HistoryMeta } from "~/types";

interface HistoryListProps {
  entries: HistoryMeta[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
  onViewEntry: (id: string) => void;
  onEnterSelectionMode: (id: string) => void;
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

  function handleClick(e: MouseEvent, entry: HistoryMeta): void {
    if (props.selectionMode) {
      props.onToggleSelect(entry.id);
    } else if (e.metaKey || e.ctrlKey) {
      props.onEnterSelectionMode(entry.id);
    } else {
      props.onViewEntry(entry.id);
    }
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
      <div class="min-h-48 space-y-2">
        <For each={props.entries}>
          {(entry) => {
            const isSelected = () => props.selectedIds.has(entry.id);
            return (
              <div class="flex items-center">
                <button
                  type="button"
                  class="group min-w-0 flex-1 rounded-lg border border-border/30 bg-card/45 px-5 py-4 text-left shadow-sm backdrop-blur-lg transition-all duration-300 hover:border-border/50 hover:shadow-md"
                  classList={{
                    "ring-2 ring-primary/50 bg-primary/5": isSelected(),
                  }}
                  onClick={(e) => handleClick(e, entry)}
                >
                  {/* Row 1: Icon + FileName */}
                  <div class="flex items-center gap-2.5">
                    <span class="shrink-0 text-muted-foreground">
                      {getSourceIcon(entry.fileName)}
                    </span>
                    <span class="flex-1 truncate text-sm font-medium">
                      {entry.fileName}
                    </span>
                  </div>
                  {/* Row 2: Text preview */}
                  <p class="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
                    {entry.textPreview}
                  </p>
                  {/* Row 3: Duration (left) + Date (right) */}
                  <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDuration(entry.duration)}</span>
                    <span>{formatDate(entry.createdAt)}</span>
                  </div>
                </button>
                <div
                  class="overflow-hidden transition-all duration-300 ease-in-out"
                  classList={{
                    "ml-3 w-6 opacity-100": props.selectionMode,
                    "ml-0 w-0 opacity-0": !props.selectionMode,
                  }}
                >
                  <Checkbox
                    checked={isSelected()}
                    onChange={() => props.onToggleSelect(entry.id)}
                  />
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
};

export { HistoryList };
