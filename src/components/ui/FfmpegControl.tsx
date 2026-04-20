import { FiDownload, FiRefreshCw, FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import { toast } from "~/lib/toast";
import type { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";

export interface FfmpegControlLabels {
  deleteTitle: DictionaryKey;
  deleteDescription: DictionaryKey;
  deletedToast: DictionaryKey;
  downloadedToast: DictionaryKey;
}

interface FfmpegControlProps {
  ffmpeg: ReturnType<typeof createFfmpegDownloader>;
  /** Show "Update Available" badge + update button when ffmpeg.needsUpdate(). */
  showUpdateBadge?: boolean;
  labels: FfmpegControlLabels;
}

const FfmpegControl: Component<FfmpegControlProps> = (props) => {
  const { t } = useI18n();

  async function handleDownload() {
    await props.ffmpeg.download();
    toast.success(t(props.labels.downloadedToast));
  }

  async function handleDelete() {
    await props.ffmpeg.deleteBundled();
    toast.success(t(props.labels.deletedToast));
  }

  return (
    <div class="flex items-center justify-between rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <span class="font-medium">FFmpeg</span>
        <Show when={props.showUpdateBadge && props.ffmpeg.needsUpdate()}>
          <Badge variant="default">{t("settings.ffmpegUpdateAvailable")}</Badge>
        </Show>
      </div>
      <Show
        when={!props.ffmpeg.isBundled()}
        fallback={
          <div class="flex items-center gap-2">
            <Show when={props.showUpdateBadge && props.ffmpeg.needsUpdate()}>
              <Button
                variant="outline"
                size="sm"
                class="w-28"
                onClick={handleDownload}
              >
                <FiRefreshCw />
                {t("settings.update")}
              </Button>
            </Show>
            <ConfirmDialog
              title={t(props.labels.deleteTitle)}
              description={t(props.labels.deleteDescription)}
              confirmLabel={
                <>
                  <FiTrash2 />
                  {t("common.delete")}
                </>
              }
              onConfirm={handleDelete}
            >
              {(openDialog) => (
                <Button
                  variant="destructive"
                  size="sm"
                  class="w-28"
                  onClick={openDialog}
                >
                  <FiTrash2 />
                  {t("common.delete")}
                </Button>
              )}
            </ConfirmDialog>
          </div>
        }
      >
        <Show
          when={props.ffmpeg.isDownloading()}
          fallback={
            <Button
              variant="outline"
              size="sm"
              class="w-28"
              onClick={handleDownload}
            >
              <FiDownload />
              {t("common.download")}
            </Button>
          }
        >
          <DownloadProgress
            progress={props.ffmpeg.downloadProgress()?.progress ?? 0}
          />
        </Show>
      </Show>
    </div>
  );
};

export { FfmpegControl };
