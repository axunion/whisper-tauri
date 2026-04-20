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

/** Computes dateFrom/dateTo for a quick filter range. */
export function computeDateRange(range: QuickFilterRange): {
  dateFrom: string | undefined;
  dateTo: string | undefined;
} {
  if (range === "all") {
    return { dateFrom: undefined, dateTo: undefined };
  }

  const now = new Date();
  const dateTo = formatDateISO(now);

  const daysBack = range === "last7days" ? 6 : 29;
  const from = new Date(now);
  from.setDate(now.getDate() - daysBack);
  return { dateFrom: formatDateISO(from), dateTo };
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${day}`;
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
