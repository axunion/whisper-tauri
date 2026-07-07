import { For } from "solid-js";
import { useI18n } from "~/i18n";

interface OnboardingStepIndicatorProps {
  current: number;
  total: number;
}

export function OnboardingStepIndicator(props: OnboardingStepIndicatorProps) {
  const { t } = useI18n();
  return (
    <div class="flex gap-1.5">
      <span class="sr-only">
        {t("onboarding.stepIndicator", {
          current: props.current,
          total: props.total,
        })}
      </span>
      <For each={Array.from({ length: props.total })}>
        {(_, i) => (
          <div
            aria-hidden="true"
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
