import { useNavigate } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import { FiMic, FiUpload } from "solid-icons/fi";
import { CardButton, CardContent } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import { AUDIO_EXTENSIONS } from "~/lib/constants";

export function QuickActions() {
  const { t } = useI18n();
  const navigate = useNavigate();

  async function handleFileSelect() {
    const selected = await open({
      multiple: false,
      title: t("dialog.openAudioTitle"),
      filters: [
        {
          name: t("dialog.audioFilter"),
          extensions: AUDIO_EXTENSIONS,
        },
      ],
    });

    if (selected) {
      navigate("/transcription", { state: { filePath: selected } });
    }
  }

  function handleRecord() {
    navigate("/transcription", { state: { tab: "record" } });
  }

  return (
    <div class="grid grid-cols-2 gap-3">
      <CardButton onClick={handleFileSelect}>
        <CardContent class="flex flex-col items-center justify-center gap-3 p-6">
          <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FiUpload class="size-6" />
          </div>
          <div class="text-center">
            <div class="text-sm font-medium">
              {t("dashboard.quickActionFile")}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              {t("dashboard.quickActionFileDesc")}
            </div>
          </div>
        </CardContent>
      </CardButton>

      <CardButton onClick={handleRecord}>
        <CardContent class="flex flex-col items-center justify-center gap-3 p-6">
          <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FiMic class="size-6" />
          </div>
          <div class="text-center">
            <div class="text-sm font-medium">
              {t("dashboard.quickActionRecord")}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              {t("dashboard.quickActionRecordDesc")}
            </div>
          </div>
        </CardContent>
      </CardButton>
    </div>
  );
}
