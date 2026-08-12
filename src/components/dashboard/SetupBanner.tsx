import { useNavigate } from "@solidjs/router";
import { FiArrowRight, FiMic, FiTool } from "solid-icons/fi";
import { TbOutlineSparkles } from "solid-icons/tb";
import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { CardButton, CardContent } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import { createWhisper } from "~/primitives/createWhisper";

export function SetupBanner() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const whisper = createWhisper();
  const ffmpeg = createFfmpegDownloader();
  const textProcessing = createTextProcessing();
  // The banner nags about missing setup, so it stays hidden until the probes
  // have run at least once — otherwise it flashes on every cold start. The
  // readiness values themselves come from the shared primitives, so a download
  // finishing on another page updates the banner without a remount.
  const [probed, setProbed] = createSignal(false);

  onMount(async () => {
    // Each loader records its own failure in the primitive's error signal, so
    // these never reject; a failed probe simply leaves readiness false.
    await Promise.all([
      whisper.loadModels(),
      ffmpeg.checkStatus(),
      textProcessing.checkServer(),
      textProcessing.loadModels(),
    ]);
    setProbed(true);
  });

  const allReady = () =>
    whisper.hasDownloadedModel() &&
    ffmpeg.isBundled() &&
    textProcessing.isReady();
  const visible = () => probed() && !allReady();

  return (
    <Show when={visible()}>
      <CardButton class="text-left" onClick={() => navigate("/settings")}>
        <CardContent class="flex items-center gap-4 p-4">
          <div class="flex flex-1 items-center gap-3">
            <Show when={!whisper.hasDownloadedModel()}>
              <SetupIndicator
                icon={<FiMic class="size-3.5" />}
                label={t("dashboard.setupModelHint")}
              />
            </Show>
            <Show when={!ffmpeg.isBundled()}>
              <SetupIndicator
                icon={<FiTool class="size-3.5" />}
                label={t("dashboard.setupFfmpegHint")}
              />
            </Show>
            <Show when={!textProcessing.isReady()}>
              <SetupIndicator
                icon={<TbOutlineSparkles class="size-3.5" />}
                label={t("dashboard.setupAiHint")}
              />
            </Show>
          </div>
          <FiArrowRight class="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </CardButton>
    </Show>
  );
}

function SetupIndicator(props: { icon: JSX.Element; label: string }) {
  return (
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <div class="flex size-6 items-center justify-center rounded-md bg-muted">
        {props.icon}
      </div>
      <span>{props.label}</span>
    </div>
  );
}
