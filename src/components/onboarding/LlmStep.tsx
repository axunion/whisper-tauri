import { FiCheck, FiDownload } from "solid-icons/fi";
import { TbOutlineSparkles } from "solid-icons/tb";
import { For, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { useI18n } from "~/i18n";
import { getModelDescription } from "~/lib/modelDescription";
import { toast } from "~/lib/toast";
import type { createTextProcessing } from "~/primitives/createTextProcessing";

interface LlmStepProps {
  textProcessing: ReturnType<typeof createTextProcessing>;
}

export function LlmStep(props: LlmStepProps) {
  const { t } = useI18n();

  async function handleDownload(modelId: string) {
    const ok = await props.textProcessing.downloadModel(modelId);
    if (ok) {
      toast.success(t("textProcessing.modelDownloadedToast"));
    }
  }

  return (
    <div class="animate-fade-in mx-auto flex w-full max-w-lg flex-col items-center gap-5 text-center">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
        <TbOutlineSparkles class="size-6" />
      </div>

      <div class="space-y-1.5">
        <div class="text-lg font-bold tracking-tight">
          {t("onboarding.llmTitle")}
        </div>
        <p class="text-xs text-muted-foreground">
          {t("onboarding.llmDescription")}
        </p>
      </div>

      <div class="w-full space-y-2">
        <For each={props.textProcessing.models()}>
          {(model) => (
            <div class="rounded-lg border p-3">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5 text-left">
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
                          props.textProcessing.isDownloading() &&
                          props.textProcessing.downloadingModelId() === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={() => handleDownload(model.id)}
                            disabled={props.textProcessing.isDownloading()}
                          >
                            <FiDownload />
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <DownloadProgress
                          progress={
                            props.textProcessing.downloadPhase() === "server"
                              ? 0
                              : (props.textProcessing.downloadProgress()
                                  ?.progress ?? 0)
                          }
                          label={
                            props.textProcessing.downloadPhase() === "server"
                              ? t("textProcessing.settingUp")
                              : undefined
                          }
                        />
                      </Show>
                    }
                  >
                    <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <FiCheck class="size-3.5" />
                      {t("onboarding.summaryReady")}
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      <ErrorDisplay
        error={props.textProcessing.error()}
        onDismiss={() => props.textProcessing.clearError()}
      />
    </div>
  );
}
