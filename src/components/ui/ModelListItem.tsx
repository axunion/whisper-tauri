import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { cn } from "~/lib/utils";
import { Badge } from "./Badge";

interface ModelListItemProps {
  name: string;
  size: string;
  description: string;
  downloaded: boolean;
  selected: boolean;
  onSelect: () => void;
  actionSlot: JSX.Element;
}

export function ModelListItem(props: ModelListItemProps) {
  return (
    <div
      class={cn(
        "flex items-center rounded-lg border transition-colors",
        props.downloaded
          ? props.selected
            ? "ring-2 ring-primary border-primary/30 bg-primary/5"
            : "hover:bg-muted/50"
          : "opacity-50",
      )}
    >
      <button
        type="button"
        class="flex flex-1 items-center gap-3 p-4 text-left"
        disabled={!props.downloaded}
        onClick={props.onSelect}
        role="radio"
        aria-checked={props.selected}
      >
        <Show
          when={props.downloaded}
          fallback={<div class="size-4 shrink-0" />}
        >
          <div
            class={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              props.selected
                ? "border-primary bg-primary"
                : "border-muted-foreground/30",
            )}
          >
            <Show when={props.selected}>
              <div class="size-1.5 rounded-full bg-primary-foreground" />
            </Show>
          </div>
        </Show>

        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{props.name}</span>
            <Badge variant="secondary">{props.size}</Badge>
          </div>
          <p class="text-sm text-muted-foreground">{props.description}</p>
        </div>
      </button>

      <div class="flex shrink-0 items-center pr-4">
        {props.actionSlot}
      </div>
    </div>
  );
}
