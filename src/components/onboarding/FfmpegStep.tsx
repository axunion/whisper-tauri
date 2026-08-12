import { FiCheck, FiDownload, FiTool } from "solid-icons/fi";
import { Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Button } from "~/components/ui/Button";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { useI18n } from "~/i18n";
import { runWithToast } from "~/lib/actionToast";
import type { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";

interface FfmpegStepProps {
  ffmpeg: ReturnType<typeof createFfmpegDownloader>;
}

export function FfmpegStep(props: FfmpegStepProps) {
  const { t } = useI18n();

  async function handleDownload() {
    await runWithToast({
      action: () => props.ffmpeg.download(),
      successKey: "settings.ffmpegDownloadedToast",
      error: props.ffmpeg.error,
      t,
    });
  }

  const isReady = () => props.ffmpeg.isBundled();

  return (
    <div class="animate-fade-in flex flex-col items-center gap-5 text-center">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
        <FiTool class="size-6" />
      </div>

      <div class="space-y-1.5">
        <div class="text-lg font-bold tracking-tight">
          {t("onboarding.ffmpegTitle")}
        </div>
        <p class="text-xs text-muted-foreground">
          {t("onboarding.ffmpegDescription")}
        </p>
      </div>

      <div class="w-full max-w-xs rounded-lg border p-4">
        <div class="flex flex-col items-center gap-3">
          <span class="text-sm font-medium">FFmpeg</span>
          <Show
            when={isReady()}
            fallback={
              <Show
                when={props.ffmpeg.isDownloading()}
                fallback={
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-32"
                    onClick={handleDownload}
                  >
                    <FiDownload />
                    {t("common.download")}
                  </Button>
                }
              >
                <DownloadProgress
                  progress={props.ffmpeg.downloadProgress()?.progress ?? 0}
                  class="w-32"
                />
              </Show>
            }
          >
            <div class="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <FiCheck class="size-4" />
              {t("onboarding.summaryReady")}
            </div>
          </Show>
        </div>
      </div>

      <ErrorDisplay
        error={props.ffmpeg.error()}
        onDismiss={() => props.ffmpeg.clearError()}
      />
    </div>
  );
}
