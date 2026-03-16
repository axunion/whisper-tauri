import type { JSX } from "solid-js";
import { For, splitProps } from "solid-js";

import { cn } from "~/lib/utils";

interface ToggleGroupProps {
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * A segmented control: always exactly one item selected (radio-like).
 * Items are rendered via children `<ToggleGroupItem>`.
 */
function ToggleGroup(props: ToggleGroupProps) {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <div
      class={cn(
        "inline-grid auto-cols-fr grid-flow-col rounded-md bg-muted p-0.5 text-muted-foreground",
        local.class,
      )}
      {...others}
    >
      {local.children}
    </div>
  );
}

interface ToggleGroupItemProps {
  value: string;
  /** Injected by parent — do not pass manually. */
  "data-pressed"?: boolean;
  onClick?: () => void;
  class?: string | undefined;
  children: JSX.Element;
}

function ToggleGroupItem(props: ToggleGroupItemProps) {
  const [local, others] = splitProps(props, [
    "class",
    "value",
    "data-pressed",
    "onClick",
    "children",
  ]);
  return (
    <button
      type="button"
      aria-pressed={local["data-pressed"] ?? false}
      data-pressed={local["data-pressed"] ? "" : undefined}
      onClick={local.onClick}
      class={cn(
        "inline-flex items-center justify-center gap-1 rounded-sm px-4 py-1 text-xs font-medium whitespace-nowrap transition-colors",
        "data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm",
        local.class,
      )}
      {...others}
    >
      {local.children}
    </button>
  );
}

/** Helper: wraps ToggleGroup + items from a data array for the common case. */
function createToggleItems<T extends string>(
  items: readonly T[],
  value: () => string,
  onChange: (v: T) => void,
  label: (item: T) => JSX.Element,
) {
  return (
    <For each={items}>
      {(item) => (
        <ToggleGroupItem
          value={item}
          data-pressed={item === value()}
          onClick={() => onChange(item)}
        >
          {label(item)}
        </ToggleGroupItem>
      )}
    </For>
  );
}

export { createToggleItems, ToggleGroup, ToggleGroupItem };
