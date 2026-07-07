import { SectionRow } from "~/components/ui/SectionRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";

interface SettingsSelectProps<T extends { value: string; label: string }> {
  label: string;
  description: string;
  options: T[];
  value: T | null;
  onChange: (value: T) => void;
}

export function SettingsSelect<T extends { value: string; label: string }>(
  props: SettingsSelectProps<T>,
) {
  return (
    <SectionRow
      title={props.label}
      description={props.description}
      right={
        <Select<T>
          multiple={false}
          value={props.value}
          onChange={(val) => {
            if (val) props.onChange(val);
          }}
          options={props.options}
          optionValue="value"
          optionTextValue="label"
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              {itemProps.item.rawValue.label}
            </SelectItem>
          )}
        >
          <SelectTrigger class="w-48" aria-label={props.label}>
            <SelectValue<T>>
              {(state) => state.selectedOption().label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      }
    />
  );
}
