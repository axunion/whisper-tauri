import type { Component } from "solid-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import type { HistoryFilter as HistoryFilterType } from "~/types";

type QuickFilterRange = "all" | "today" | "thisWeek" | "thisMonth";

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

  if (range === "today") {
    return { dateFrom: dateTo, dateTo };
  }

  if (range === "thisWeek") {
    const day = now.getDay();
    // Monday = 0 offset; Sunday (0) becomes 6
    const mondayOffset = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    return { dateFrom: formatDateISO(monday), dateTo };
  }

  // thisMonth
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: formatDateISO(firstOfMonth), dateTo };
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${day}`;
}

const RANGES: QuickFilterRange[] = ["all", "today", "thisWeek", "thisMonth"];

const RANGE_KEYS: Record<QuickFilterRange, DictionaryKey> = {
  today: "history.filterToday",
  thisWeek: "history.filterThisWeek",
  thisMonth: "history.filterThisMonth",
  all: "history.filterAll",
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

  function handleSelect(range: QuickFilterRange): void {
    const { dateFrom, dateTo } = computeDateRange(range);
    const next: HistoryFilterType = { ...props.filter };
    if (dateFrom) {
      next.dateFrom = dateFrom;
    } else {
      delete next.dateFrom;
    }
    if (dateTo) {
      next.dateTo = dateTo;
    } else {
      delete next.dateTo;
    }
    props.onFilterChange(next);
  }

  return (
    <Select
      value={detectActiveRange(props.filter)}
      onChange={(v) => {
        if (v) handleSelect(v);
      }}
      options={RANGES}
      class="min-w-0"
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>
          {t(RANGE_KEYS[itemProps.item.rawValue])}
        </SelectItem>
      )}
    >
      <SelectTrigger class="h-9 w-full">
        <SelectValue<QuickFilterRange>>
          {(state) => t(RANGE_KEYS[state.selectedOption()])}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );
};

export { HistoryFilter };
