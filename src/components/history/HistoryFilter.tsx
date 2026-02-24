import { FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { Label } from "~/components/ui/Label";
import type { HistoryFilter as HistoryFilterType } from "~/types";

interface HistoryFilterProps {
  filter: HistoryFilterType;
  onFilterChange: (filter: HistoryFilterType) => void;
}

const HistoryFilter: Component<HistoryFilterProps> = (props) => {
  const hasFilter = () => props.filter.dateFrom || props.filter.dateTo;

  function buildFilter(
    patch: Partial<{ dateFrom: string; dateTo: string }>,
  ): HistoryFilterType {
    const next: HistoryFilterType = {};
    const from = "dateFrom" in patch ? patch.dateFrom : props.filter.dateFrom;
    const to = "dateTo" in patch ? patch.dateTo : props.filter.dateTo;
    if (from) next.dateFrom = from;
    if (to) next.dateTo = to;
    return next;
  }

  return (
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <Label class="text-xs">From</Label>
        <input
          type="date"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={props.filter.dateFrom ?? ""}
          onInput={(e) =>
            props.onFilterChange(
              buildFilter({ dateFrom: e.currentTarget.value }),
            )
          }
        />
      </div>
      <div class="flex flex-col gap-1">
        <Label class="text-xs">To</Label>
        <input
          type="date"
          class="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={props.filter.dateTo ?? ""}
          onInput={(e) =>
            props.onFilterChange(buildFilter({ dateTo: e.currentTarget.value }))
          }
        />
      </div>
      <Show when={hasFilter()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => props.onFilterChange({})}
        >
          <FiX class="size-4" />
          Clear
        </Button>
      </Show>
    </div>
  );
};

export { HistoryFilter };
