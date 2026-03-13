import { Label } from "~/components/ui/Label";
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
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>{props.label}</Label>
        <p class="text-sm text-muted-foreground">{props.description}</p>
      </div>
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
        <SelectTrigger class="w-48">
          <SelectValue<T>>
            {(state) => state.selectedOption().label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    </div>
  );
}
