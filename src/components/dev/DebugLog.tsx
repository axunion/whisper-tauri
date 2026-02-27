import { For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import type { createDevLog, LogLevel } from "~/primitives/createDevLog";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/Select";

type OptionItem = { value: string; label: string };

const LEVEL_OPTIONS: OptionItem[] = [
  { value: "ALL", label: "All" },
  { value: "DEBUG", label: "DEBUG" },
  { value: "INFO", label: "INFO" },
  { value: "WARN", label: "WARN" },
  { value: "ERROR", label: "ERROR" },
];

const LEVEL_VARIANT: Record<LogLevel, "default" | "secondary" | "outline"> = {
  DEBUG: "secondary",
  INFO: "outline",
  WARN: "default",
  ERROR: "default",
};

interface DebugLogProps {
  devLog: ReturnType<typeof createDevLog>;
}

export function DebugLog(props: DebugLogProps) {
  const { t } = useI18n();

  function currentOption(): OptionItem {
    const filter = props.devLog.levelFilter();
    return (
      LEVEL_OPTIONS.find((o) => o.value === (filter ?? "ALL")) ??
      (LEVEL_OPTIONS[0] as OptionItem)
    );
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <Select<OptionItem>
          multiple={false}
          value={currentOption()}
          onChange={(val) => {
            if (val) {
              props.devLog.setLevelFilter(
                val.value === "ALL" ? null : (val.value as LogLevel),
              );
            }
          }}
          options={LEVEL_OPTIONS}
          optionValue="value"
          optionTextValue="label"
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              {itemProps.item.rawValue.label}
            </SelectItem>
          )}
        >
          <SelectTrigger class="w-32">
            <SelectValue<OptionItem>>
              {(state) => state.selectedOption().label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.devLog.clear()}
          >
            {t("common.clear")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await props.devLog.copyAll();
                toast.success(t("dev.logCopiedToast"));
              } catch {
                toast.error(t("dev.logCopyFailedToast"));
              }
            }}
          >
            {t("common.copy")}
          </Button>
        </div>
      </div>
      <div class="h-64 overflow-y-auto rounded-md border p-2 font-mono text-xs">
        <Show
          when={props.devLog.filteredLogs().length > 0}
          fallback={<p class="text-muted-foreground">{t("dev.noLogs")}</p>}
        >
          <For each={props.devLog.filteredLogs()}>
            {(entry) => (
              <div class="flex items-start gap-2 py-0.5">
                <Badge
                  variant={LEVEL_VARIANT[entry.level]}
                  class={
                    entry.level === "ERROR"
                      ? "bg-destructive text-destructive-foreground"
                      : entry.level === "WARN"
                        ? "bg-yellow-500 text-white"
                        : ""
                  }
                >
                  {entry.level}
                </Badge>
                <span class="shrink-0 text-muted-foreground">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <span class="break-all">{entry.message}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
