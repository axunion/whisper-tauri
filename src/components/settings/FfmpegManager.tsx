import { FiTool } from "solid-icons/fi";
import { onMount } from "solid-js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { FfmpegControl } from "~/components/ui/FfmpegControl";
import { useI18n } from "~/i18n";
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
        <CardTitleWithIcon icon={() => <FiTool class="size-4" />}>
          {t("settings.toolManagement")}
        </CardTitleWithIcon>
      </CardHeader>
      <CardContent>
        <FfmpegControl
          ffmpeg={ffmpeg}
          showUpdateBadge
          labels={{
            deleteTitle: "settings.deleteFfmpeg",
            deleteDescription: "settings.deleteFfmpegConfirmation",
            deletedToast: "settings.ffmpegDeletedToast",
            downloadedToast: "settings.ffmpegDownloadedToast",
          }}
        />
      </CardContent>
    </Card>
  );
}
