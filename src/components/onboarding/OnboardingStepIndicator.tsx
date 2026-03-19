import { For } from "solid-js";

interface OnboardingStepIndicatorProps {
  current: number;
  total: number;
}

export function OnboardingStepIndicator(props: OnboardingStepIndicatorProps) {
  return (
    <div class="flex gap-1.5">
      <For each={Array.from({ length: props.total })}>
        {(_, i) => (
          <div
            class="h-1.5 rounded-full transition-all duration-300"
            classList={{
              "bg-primary w-8": i() + 1 === props.current,
              "bg-primary/40 w-2": i() + 1 < props.current,
              "bg-muted w-2": i() + 1 > props.current,
            }}
          />
        )}
      </For>
    </div>
  );
}
