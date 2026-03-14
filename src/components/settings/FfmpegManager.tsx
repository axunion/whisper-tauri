import { FiDownload, FiTrash2 } from "solid-icons/fi";
import { onMount, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";

export default function FfmpegManager() {
  const { t } = useI18n();
  const ffmpeg = createFfmpegDownloader();

  onMount(() => {
    ffmpeg.checkStatus();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.toolManagement")}</CardTitle>
        <CardDescription>
          {t("settings.toolManagementDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="flex items-center gap-2">
            <span class="font-medium">FFmpeg</span>
            <Show when={ffmpeg.isSystemAvailable()}>
              <Badge variant="secondary">{t("settings.systemInstalled")}</Badge>
            </Show>
          </div>
          <Show
            when={!ffmpeg.isBundled()}
            fallback={
              <Button
                variant="destructive"
                size="sm"
                class="w-28"
                onClick={async () => {
                  await ffmpeg.deleteBundled();
                  toast.success(t("settings.ffmpegDeletedToast"));
                }}
              >
                <FiTrash2 />
                {t("common.delete")}
              </Button>
            }
          >
            <Show
              when={ffmpeg.isDownloading()}
              fallback={
                <Button
                  variant="outline"
                  size="sm"
                  class="w-28"
                  onClick={async () => {
                    await ffmpeg.download();
                    toast.success(t("settings.ffmpegDownloadedToast"));
                  }}
                >
                  <FiDownload />
                  {t("common.download")}
                </Button>
              }
            >
              <div class="w-28 space-y-1">
                <Progress
                  value={ffmpeg.downloadProgress()?.progress ?? 0}
                  minValue={0}
                  maxValue={100}
                />
                <p class="text-center text-xs text-muted-foreground">
                  {Math.round(ffmpeg.downloadProgress()?.progress ?? 0)}%
                </p>
              </div>
            </Show>
          </Show>
        </div>
      </CardContent>
    </Card>
  );
}
