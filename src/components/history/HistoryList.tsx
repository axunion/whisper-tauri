import {
  FiCalendar,
  FiClock,
  FiFileText,
  FiMic,
  FiMusic,
  FiVideo,
} from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
import { CheckIndicator } from "~/components/history/CheckIndicator";
import { VadBadge } from "~/components/history/VadBadge";
import { useI18n } from "~/i18n";
import { formatDate, formatDuration } from "~/lib/format";
import type { HistoryMeta } from "~/types";

interface HistoryListProps {
  entries: HistoryMeta[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
  onViewEntry: (id: string) => void;
  onEnterSelectionMode: (id: string) => void;
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
              <button
                type="button"
                class="group w-full min-w-0 cursor-pointer rounded-lg border border-border/30 bg-card/45 px-5 py-4 text-left shadow-sm backdrop-blur-lg transition-all duration-300 hover:scale-[1.01] hover:border-border/50 hover:bg-accent/50 hover:shadow-md"
                classList={{
                  "ring-2 ring-primary/50 bg-primary/5": isSelected(),
                }}
                onClick={(e) => handleClick(e, entry)}
              >
                {/* Row 1: Icon + FileName + Check */}
                <div class="flex items-center gap-2.5">
                  <span class="shrink-0 text-muted-foreground">
                    {getSourceIcon(entry.fileName)}
                  </span>
                  <span class="flex-1 truncate text-sm font-medium">
                    {entry.fileName}
                  </span>
                  <span
                    class="shrink-0 transition-opacity duration-200"
                    classList={{
                      "opacity-100": props.selectionMode,
                      "opacity-0": !props.selectionMode,
                    }}
                  >
                    <CheckIndicator checked={isSelected()} />
                  </span>
                </div>
                {/* Row 2: Text preview */}
                <p class="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
                  {entry.textPreview}
                </p>
                <div class="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    <FiCalendar class="size-3" />
                    {formatDate(entry.createdAt, locale())}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <FiMusic class="size-3" />
                    {entry.modelId}
                  </span>
                  <VadBadge vadEnabled={entry.vadEnabled} />
                  <span class="ml-auto inline-flex items-center gap-1">
                    <FiClock class="size-3" />
                    {formatDuration(entry.duration)}
                  </span>
                </div>
              </button>
            );
          }}
        </For>
      </div>
    </Show>
  );
};

export { HistoryList };
