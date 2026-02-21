import { invoke } from "@tauri-apps/api/core";
import { createSignal, For, onMount, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import type { ModelInfo } from "~/types/whisper";

export function ModelStatus() {
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
        <CardTitle>Model Status</CardTitle>
      </CardHeader>
      <CardContent>
        <Show
          when={!loading()}
          fallback={
            <p class="text-sm text-muted-foreground">Loading models...</p>
          }
        >
          <Show
            when={models().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">No models available.</p>
            }
          >
            <div class="space-y-3">
              <For each={models()}>
                {(model) => (
                  <div class="flex items-center justify-between rounded-lg border p-3">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">{model.name}</span>
                      <Badge variant="secondary">{model.size}</Badge>
                      <Show when={model.speedNote}>
                        <Badge variant="outline">{model.speedNote}</Badge>
                      </Show>
                      <Show when={model.recommended}>
                        <Badge>Recommended</Badge>
                      </Show>
                    </div>
                    <Badge variant={model.downloaded ? "default" : "outline"}>
                      {model.downloaded ? "Downloaded" : "Not Downloaded"}
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
