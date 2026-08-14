import { type Component, createMemo } from "solid-js";
import { createToggleItems, ToggleGroup } from "~/components/ui/ToggleGroup";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import type { HistoryFilter as HistoryFilterType } from "~/types";

type QuickFilterRange = "all" | "last7days" | "last30days";

interface HistoryFilterProps {
  filter: HistoryFilterType;
  onFilterChange: (filter: HistoryFilterType) => void;
}

/**
 * Computes the half-open `[dateFrom, dateTo)` bounds for a quick filter range.
 *
 * `history.created_at` holds UTC wall-clock, so the local midnights the user
 * means by "last 7 days" have to be converted to UTC before they can be
 * compared. The bounds are truncated to 19 characters to match the stored
 * format exactly — the comparison is lexicographic, so a trailing `.000Z`
 * would sort after a stored value at the very same instant and drop it.
 */
function computeDateRange(range: QuickFilterRange): {
  dateFrom: string | undefined;
  dateTo: string | undefined;
} {
  if (range === "all") {
    return { dateFrom: undefined, dateTo: undefined };
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const daysBack = range === "last7days" ? 6 : 29;

  return {
    dateFrom: toUtcStamp(new Date(y, m, d - daysBack)),
    dateTo: toUtcStamp(new Date(y, m, d + 1)),
  };
}

function toUtcStamp(d: Date): string {
  return d.toISOString().slice(0, 19);
}

const RANGES: readonly QuickFilterRange[] = [
  "all",
  "last7days",
  "last30days",
] as const;

const RANGE_KEYS: Record<QuickFilterRange, DictionaryKey> = {
  all: "history.filterAll",
  last7days: "history.filterLast7days",
  last30days: "history.filterLast30days",
};

function detectActiveRange(filter: HistoryFilterType): QuickFilterRange {
  if (!filter.dateFrom && !filter.dateTo) return "all";
  for (const range of RANGES) {
    if (range === "all") continue;
    const { dateFrom, dateTo } = computeDateRange(range);
    if (filter.dateFrom === dateFrom && filter.dateTo === dateTo) return range;
  }
  return "all";
}

const HistoryFilter: Component<HistoryFilterProps> = (props) => {
  const { t } = useI18n();
  const activeRange = createMemo(() => detectActiveRange(props.filter));

  function handleSelect(range: QuickFilterRange): void {
    if (range === activeRange()) return;
    const { dateFrom, dateTo } = computeDateRange(range);
    const { dateFrom: _from, dateTo: _to, ...rest } = props.filter;
    props.onFilterChange({
      ...rest,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    });
  }

  return (
    <ToggleGroup>
      {createToggleItems(RANGES, activeRange, handleSelect, (range) =>
        t(RANGE_KEYS[range]),
      )}
    </ToggleGroup>
  );
};

export { HistoryFilter };
