import type { Component } from "solid-js";
import { Show } from "solid-js";
import { useI18n } from "~/i18n";
import { formatBytes } from "~/lib/format";

interface TotalSizeFooterProps {
  bytes: number;
}

const TotalSizeFooter: Component<TotalSizeFooterProps> = (props) => {
  const { t } = useI18n();
  return (
    <Show when={props.bytes > 0}>
      <p class="text-right text-xs text-muted-foreground">
        {t("settings.totalSize", { size: formatBytes(props.bytes) })}
      </p>
    </Show>
  );
};

export { TotalSizeFooter };
