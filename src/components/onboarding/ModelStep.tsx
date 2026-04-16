import { FiCheck, FiDownload } from "solid-icons/fi";
import { For, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { getModelDescription } from "~/lib/modelDescription";
import type { createWhisper } from "~/primitives/createWhisper";

interface ModelStepProps {
  whisper: ReturnType<typeof createWhisper>;
}

export function ModelStep(props: ModelStepProps) {
  const { t } = useI18n();

  const hasDownloadedModel = () =>
    props.whisper.models().some((m) => m.downloaded);

  return (
    <div class="animate-fade-in mx-auto flex w-full max-w-lg flex-col gap-3">
      <div class="text-center">
        <div class="text-lg font-bold tracking-tight">
          {t("onboarding.modelTitle")}
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          {t("onboarding.modelSubtitle")}
        </p>
      </div>

      <div class="space-y-2">
        <For each={props.whisper.models()}>
          {(model) => (
            <div class="rounded-lg border p-3">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">{model.name}</span>
                    <Badge variant="secondary">{model.size}</Badge>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {getModelDescription(t, model.id, model.description)}
                  </p>
                </div>
                <div class="ml-4 shrink-0">
                  <Show
                    when={model.downloaded}
                    fallback={
                      <Show
                        when={
                          props.whisper.isDownloading() &&
                          props.whisper.downloadProgress()?.modelId === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={() =>
                              props.whisper.downloadModel(model.id)
                            }
                            disabled={props.whisper.isDownloading()}
                          >
                            <FiDownload />
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <div class="w-28 space-y-1">
                          <Progress
                            value={
                              props.whisper.downloadProgress()?.progress ?? 0
                            }
                            minValue={0}
                            maxValue={100}
                          />
                          <p class="text-center text-xs text-muted-foreground">
                            {Math.round(
                              props.whisper.downloadProgress()?.progress ?? 0,
                            )}
                            %
                          </p>
                        </div>
                      </Show>
                    }
                  >
                    <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <FiCheck class="size-3.5" />
                      {t("onboarding.modelReady")}
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show
        when={hasDownloadedModel()}
        fallback={
          <p class="text-center text-xs text-muted-foreground">
            {t("onboarding.modelRequired")}
          </p>
        }
      >
        <p class="text-center text-xs text-muted-foreground">
          {t("onboarding.modelDownloadLater")}
        </p>
      </Show>

      <ErrorDisplay
        error={props.whisper.error()}
        onDismiss={() => props.whisper.clearError()}
      />
    </div>
  );
}
