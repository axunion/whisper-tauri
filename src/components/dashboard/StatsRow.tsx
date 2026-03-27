import { useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { FiClock, FiFileText, FiMic, FiTool } from "solid-icons/fi";
import { TbSparkles } from "solid-icons/tb";
import type { JSX } from "solid-js";
import { createMemo, createSignal, onMount, Show } from "solid-js";
import { Card, CardContent } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import { formatDurationShort } from "~/lib/format";
import { createHistory } from "~/primitives/createHistory";
import type { TextModelInfo } from "~/types/text-processing";
import type { ModelInfo } from "~/types/whisper";

interface StatCardProps {
  icon: JSX.Element;
  value: string;
  label: string;
}

function StatCard(props: StatCardProps) {
  return (
    <Card>
      <CardContent class="p-4 text-center">
        <div class="mx-auto mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {props.icon}
        </div>
        <div class="text-2xl font-bold tabular-nums">{props.value}</div>
        <div class="mt-0.5 text-xs text-muted-foreground">{props.label}</div>
      </CardContent>
    </Card>
  );
}

function SetupItem(props: {
  ready: boolean;
  label: string;
  icon: JSX.Element;
}) {
  return (
    <div class="flex flex-col items-center gap-1">
      <div
        class={`flex size-7 items-center justify-center rounded-md ${
          props.ready
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-muted text-muted-foreground/40"
        }`}
      >
        {props.icon}
      </div>
      <span class="text-[10px] text-muted-foreground">{props.label}</span>
    </div>
  );
}

function SetupCard(props: {
  whisper: boolean;
  ffmpeg: boolean;
  ai: boolean;
  loading: boolean;
  modelLabel: string;
  ffmpegLabel: string;
  aiLabel: string;
}) {
  const navigate = useNavigate();

  return (
    <Card
      class="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => navigate("/settings")}
    >
      <CardContent class="flex h-full items-center justify-center p-4">
        <Show
          when={!props.loading}
          fallback={
            <span class="text-2xl font-bold text-muted-foreground">--</span>
          }
        >
          <div class="flex items-start gap-4">
            <SetupItem
              ready={props.whisper}
              label={props.modelLabel}
              icon={<FiMic class="size-3.5" />}
            />
            <SetupItem
              ready={props.ffmpeg}
              label={props.ffmpegLabel}
              icon={<FiTool class="size-3.5" />}
            />
            <SetupItem
              ready={props.ai}
              label={props.aiLabel}
              icon={<TbSparkles class="size-3.5" />}
            />
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}

export function StatsRow() {
  const { t } = useI18n();
  const history = createHistory();
  const [whisperReady, setWhisperReady] = createSignal(false);
  const [ffmpegReady, setFfmpegReady] = createSignal(false);
  const [aiReady, setAiReady] = createSignal(false);
  const [statusLoading, setStatusLoading] = createSignal(true);

  onMount(async () => {
    history.loadEntries();
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
      setStatusLoading(false);
    }
  });

  const totalDuration = createMemo(() => {
    const entries = history.entries();
    if (entries.length === 0) return formatDurationShort(0);
    const total = entries.reduce((sum, e) => sum + e.duration, 0);
    return formatDurationShort(total);
  });

  return (
    <div class="grid grid-cols-3 gap-3">
      <StatCard
        icon={<FiFileText class="size-4" />}
        value={history.isLoading() ? "--" : String(history.entries().length)}
        label={t("dashboard.statsTranscriptions")}
      />
      <StatCard
        icon={<FiClock class="size-4" />}
        value={history.isLoading() ? "--" : totalDuration()}
        label={t("dashboard.statsTotalDuration")}
      />
      <SetupCard
        whisper={whisperReady()}
        ffmpeg={ffmpegReady()}
        ai={aiReady()}
        loading={statusLoading()}
        modelLabel={t("dashboard.setupModel")}
        ffmpegLabel={t("dashboard.setupFfmpeg")}
        aiLabel={t("dashboard.setupAi")}
      />
    </div>
  );
}
