import type { Component } from "solid-js";
import { For } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import type { HistoryFilter as HistoryFilterType } from "~/types";

type QuickFilterRange = "today" | "thisWeek" | "thisMonth" | "all";

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
    <div class="flex items-center gap-2">
      <For each={RANGES}>
        {(range) => {
          const active = () => detectActiveRange(props.filter) === range;
          return (
            <Button
              variant={active() ? "default" : "outline"}
              class="h-7 w-[5.5rem] px-1 text-xs"
              onClick={() => handleSelect(range)}
            >
              {t(RANGE_KEYS[range])}
            </Button>
          );
        }}
      </For>
    </div>
  );
};

export { HistoryFilter };
