import type { Component } from "solid-js";
import { Show } from "solid-js";

interface CheckIndicatorProps {
  checked: boolean;
  indeterminate?: boolean;
}

const CheckIndicator: Component<CheckIndicatorProps> = (props) => {
  return (
    <span
      class="flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary ring-offset-background"
      classList={{
        "bg-primary text-primary-foreground": props.checked || props.indeterminate,
      }}
    >
      <Show when={props.checked || props.indeterminate}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-3.5"
          aria-hidden="true"
        >
          {props.indeterminate ? (
            <line x1="5" y1="12" x2="19" y2="12" />
          ) : (
            <path d="M20 6 9 17l-5-5" />
          )}
        </svg>
      </Show>
    </span>
  );
};

export { CheckIndicator };
