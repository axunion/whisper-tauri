import { FiCheck, FiDownload } from "solid-icons/fi";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/utils";
import type { DownloadProgress, ModelInfo } from "~/types";

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  downloadProgress: DownloadProgress | null;
  isDownloading: boolean;
  onSelectModel: (model: ModelInfo) => void;
  onDownloadModel: (modelId: string) => void;
}

const ModelSelector: Component<ModelSelectorProps> = (props) => {
  const { t } = useI18n();

  return (
    <div class="grid gap-3">
      <For each={props.models}>
        {(model) => {
          const isSelected = () => props.selectedModel?.id === model.id;
          const isDownloadingThis = () =>
            props.isDownloading && props.downloadProgress?.modelId === model.id;

          return (
            <button
              type="button"
              class={cn(
                "flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
                model.downloaded
                  ? "cursor-pointer hover:bg-accent"
                  : "cursor-default",
                isSelected() && "border-primary",
              )}
              onClick={() => {
                if (model.downloaded) {
                  props.onSelectModel(model);
                }
              }}
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{model.name}</span>
                  <Badge variant="secondary">{model.size}</Badge>
                  <Show when={model.recommended}>
                    <Badge variant="default">{t("common.recommended")}</Badge>
                  </Show>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">
                  {model.description}
                </p>
                <Show when={isDownloadingThis()}>
                  <div class="mt-2">
                    <Progress value={props.downloadProgress?.progress ?? 0} />
                  </div>
                </Show>
              </div>

              <div class="flex w-28 shrink-0 items-center justify-center">
                <Show
                  when={model.downloaded}
                  fallback={
                    <Show when={!isDownloadingThis()}>
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-full"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          props.onDownloadModel(model.id);
                        }}
                      >
                        <FiDownload class="size-4" />
                        {t("common.download")}
                      </Button>
                    </Show>
                  }
                >
                  <Show
                    when={isSelected()}
                    fallback={<FiCheck class="size-5 text-muted-foreground" />}
                  >
                    <FiCheck class="size-5 text-primary" />
                  </Show>
                </Show>
              </div>
            </button>
          );
        }}
      </For>
    </div>
  );
};

export { ModelSelector };
