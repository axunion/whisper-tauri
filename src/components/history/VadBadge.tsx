import { FiActivity } from "solid-icons/fi";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { useI18n } from "~/i18n";

interface VadBadgeProps {
  vadEnabled: boolean | null;
}

const VadBadge: Component<VadBadgeProps> = (props) => {
  const { t } = useI18n();

  return (
    <Show when={props.vadEnabled !== null}>
      <span class="inline-flex items-center gap-1">
        <FiActivity class="size-3" />
        {props.vadEnabled
          ? t("history.vadEnabledLabel")
          : t("history.vadDisabledLabel")}
      </span>
    </Show>
  );
};

export { VadBadge };
