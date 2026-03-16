import * as SelectPrimitive from "@kobalte/core/select";
import { FiArrowDown, FiArrowUp } from "solid-icons/fi";
import type { Component } from "solid-js";
import { SelectContent, SelectItem } from "~/components/ui/Select";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import type { HistorySortBy, SortOrder } from "~/types";

interface SortToggleGroupProps {
  sortBy: HistorySortBy;
  sortOrder: SortOrder;
  onChange: (sortBy: HistorySortBy, sortOrder: SortOrder) => void;
}

const SORT_OPTIONS: HistorySortBy[] = ["date", "duration", "fileName"];

const SORT_KEYS: Record<HistorySortBy, DictionaryKey> = {
  date: "history.sortDate",
  duration: "history.sortLength",
  fileName: "history.sortFileName",
};

const SortToggleGroup: Component<SortToggleGroupProps> = (props) => {
  const { t } = useI18n();

  function handleChange(value: HistorySortBy | null): void {
    if (!value || value === props.sortBy) return;
    props.onChange(value, "desc");
  }

  function toggleDirection(): void {
    props.onChange(props.sortBy, props.sortOrder === "asc" ? "desc" : "asc");
  }

  return (
    <div class="group/sort inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
      <SelectPrimitive.Root
        value={props.sortBy}
        onChange={handleChange}
        options={SORT_OPTIONS}
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {t(SORT_KEYS[itemProps.item.rawValue])}
          </SelectItem>
        )}
      >
        <SelectPrimitive.Trigger class="inline-flex items-center focus:outline-none">
          <SelectPrimitive.Value<HistorySortBy>>
            {(state) => t(SORT_KEYS[state.selectedOption()])}
          </SelectPrimitive.Value>
        </SelectPrimitive.Trigger>
        <SelectContent />
      </SelectPrimitive.Root>
      <button
        type="button"
        onClick={toggleDirection}
        aria-label={
          props.sortOrder === "asc"
            ? t("history.sortDesc")
            : t("history.sortAsc")
        }
        class="inline-flex items-center focus:outline-none"
      >
        {props.sortOrder === "asc" ? (
          <FiArrowUp class="size-3.5" />
        ) : (
          <FiArrowDown class="size-3.5" />
        )}
      </button>
    </div>
  );
};

export { SortToggleGroup };
