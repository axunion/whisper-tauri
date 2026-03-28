import { FiDownload } from "solid-icons/fi";
import { createMemo, Show } from "solid-js";
import { Progress } from "~/components/ui/Progress";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { useI18n } from "~/i18n";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import { createWhisper } from "~/primitives/createWhisper";

/**
 * Global download indicator shown in the sidebar.
 * Visible whenever any download (Whisper model, FFmpeg, LLM model) is in progress.
 */
export function DownloadIndicator() {
  const { t } = useI18n();
  const sidebar = useSidebar();
  const whisper = createWhisper();
  const ffmpeg = createFfmpegDownloader();
  const tp = createTextProcessing();

  const downloadInfo = createMemo(() => {
    if (tp.isDownloading()) {
      const isServerPhase = tp.downloadPhase() === "server";
      return {
        label: isServerPhase
          ? t("common.downloadingServer")
          : t("common.downloadingTextModel"),
        progress: tp.downloadProgress()?.progress ?? 0,
      };
    }
    if (whisper.isDownloading()) {
      return {
        label: t("common.downloadingSpeechModel"),
        progress: whisper.downloadProgress()?.progress ?? 0,
      };
    }
    if (ffmpeg.isDownloading()) {
      return {
        label: t("common.downloadingFfmpeg"),
        progress: ffmpeg.downloadProgress()?.progress ?? 0,
      };
    }
    return null;
  });

  return (
    <Show when={downloadInfo()} keyed>
      {(info) => (
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <Show
                when={sidebar.state() === "expanded"}
                fallback={
                  <div class="flex justify-center py-2">
                    <FiDownload class="size-4 animate-pulse text-primary" />
                  </div>
                }
              >
                <div class="space-y-1.5 px-2 py-2">
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <FiDownload class="size-3 shrink-0 animate-pulse text-primary" />
                    <span class="truncate">{info.label}</span>
                    <span class="ml-auto tabular-nums">
                      {Math.round(info.progress)}%
                    </span>
                  </div>
                  <Progress value={info.progress} minValue={0} maxValue={100} />
                </div>
              </Show>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
    </Show>
  );
}
