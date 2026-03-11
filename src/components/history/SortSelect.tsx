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
import type { HistorySortBy } from "~/types";

interface SortSelectProps {
  value: HistorySortBy;
  onChange: (value: HistorySortBy) => void;
}

const SORT_OPTIONS: HistorySortBy[] = ["date", "duration", "fileName"];

const SORT_KEYS: Record<HistorySortBy, DictionaryKey> = {
  date: "history.sortDate",
  duration: "history.sortDuration",
  fileName: "history.sortFileName",
};

const SortSelect: Component<SortSelectProps> = (props) => {
  const { t } = useI18n();

  return (
    <Select
      value={props.value}
      onChange={(v) => {
        if (v) props.onChange(v);
      }}
      options={SORT_OPTIONS}
      class="min-w-0"
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>
          {t(SORT_KEYS[itemProps.item.rawValue])}
        </SelectItem>
      )}
    >
      <SelectTrigger class="h-9 w-full">
        <SelectValue<HistorySortBy>>
          {(state) => t(SORT_KEYS[state.selectedOption()])}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );
};

export { SortSelect };
