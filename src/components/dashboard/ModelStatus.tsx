import { invoke } from "@tauri-apps/api/core";
import { createSignal, For, onMount, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import type { ModelInfo } from "~/types/whisper";

export function ModelStatus() {
  const { t } = useI18n();
  const [models, setModels] = createSignal<ModelInfo[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const result = await invoke<ModelInfo[]>("get_available_models");
      setModels(result);
    } catch {
      // silently fail - models will show as empty
    } finally {
      setLoading(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.modelStatus")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <svg
                class="animate-spin size-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{t("dashboard.loadingModels")}</span>
            </div>
          }
        >
          <Show
            when={models().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">
                {t("dashboard.noModels")}
              </p>
            }
          >
            <div class="space-y-3">
              <For each={models()}>
                {(model) => (
                  <div class="flex items-center justify-between rounded-lg border p-4">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">{model.name}</span>
                      <Badge variant="secondary">{model.size}</Badge>
                      <Show when={model.recommended}>
                        <Badge>{t("common.recommended")}</Badge>
                      </Show>
                    </div>
                    <Badge
                      variant={model.downloaded ? "default" : "outline"}
                      class="min-w-24 justify-center text-center"
                    >
                      {model.downloaded
                        ? t("dashboard.downloaded")
                        : t("dashboard.notDownloaded")}
                    </Badge>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </CardContent>
    </Card>
  );
}
