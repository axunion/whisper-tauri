import { useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { FiArrowRight, FiMic, FiTool } from "solid-icons/fi";
import { TbOutlineSparkles } from "solid-icons/tb";
import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { Card, CardContent } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import type { TextModelInfo } from "~/types/text-processing";
import type { ModelInfo } from "~/types/whisper";

export function SetupBanner() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [whisperReady, setWhisperReady] = createSignal(false);
  const [ffmpegReady, setFfmpegReady] = createSignal(false);
  const [aiReady, setAiReady] = createSignal(false);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const [models, ffmpegAvailable, serverExists, textModels] =
        await Promise.all([
          invoke<ModelInfo[]>("get_available_models"),
          invoke<boolean>("check_ffmpeg_bundled"),
          invoke<boolean>("text_processing_check_server"),
          invoke<TextModelInfo[]>("text_processing_list_models"),
        ]);
      setWhisperReady(models.some((m) => m.downloaded));
      setFfmpegReady(ffmpegAvailable);
      setAiReady(serverExists && textModels.some((m) => m.downloaded));
    } catch {
      // Leave as false
    } finally {
      setLoading(false);
    }
  });

  const allReady = () => whisperReady() && ffmpegReady() && aiReady();
  const visible = () => !loading() && !allReady();

  return (
    <Show when={visible()}>
      <Card
        class="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={() => navigate("/settings")}
      >
        <CardContent class="flex items-center gap-4 p-4">
          <div class="flex flex-1 items-center gap-3">
            <Show when={!whisperReady()}>
              <SetupIndicator
                icon={<FiMic class="size-3.5" />}
                label={t("dashboard.setupModelHint")}
              />
            </Show>
            <Show when={!ffmpegReady()}>
              <SetupIndicator
                icon={<FiTool class="size-3.5" />}
                label={t("dashboard.setupFfmpegHint")}
              />
            </Show>
            <Show when={!aiReady()}>
              <SetupIndicator
                icon={<TbOutlineSparkles class="size-3.5" />}
                label={t("dashboard.setupAiHint")}
              />
            </Show>
          </div>
          <FiArrowRight class="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
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
