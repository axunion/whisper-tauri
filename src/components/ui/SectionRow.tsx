import { type JSX, Show } from "solid-js";

interface SectionRowProps {
  title: JSX.Element;
  description?: string;
  right: JSX.Element;
}

export function SectionRow(props: SectionRowProps) {
  return (
    <div class="flex items-center justify-between gap-3">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2 text-sm font-medium">
          {props.title}
        </div>
        <Show when={props.description}>
          {(description) => (
            <p class="text-sm text-muted-foreground">{description()}</p>
          )}
        </Show>
      </div>
      {props.right}
    </div>
  );
}
