import { FiCheck, FiX } from "solid-icons/fi";
import { type JSX, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import type { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import type { createTextProcessing } from "~/primitives/createTextProcessing";
import type { createWhisper } from "~/primitives/createWhisper";

interface CompletionStepProps {
  whisper: ReturnType<typeof createWhisper>;
  ffmpeg: ReturnType<typeof createFfmpegDownloader>;
  textProcessing: ReturnType<typeof createTextProcessing>;
  onComplete: () => void;
}

function SummaryRow(props: {
  label: string;
  ready: boolean;
  readyText: JSX.Element;
}) {
  const { t } = useI18n();
  return (
    <div class="flex items-center justify-between rounded-lg border px-3 py-2.5">
      <span class="text-sm">{props.label}</span>
      <Show
        when={props.ready}
        fallback={
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            <FiX class="size-3" />
            {t("onboarding.summaryNotInstalled")}
          </span>
        }
      >
        <span class="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <FiCheck class="size-3" />
          {props.readyText}
        </span>
      </Show>
    </div>
  );
}

export function CompletionStep(props: CompletionStepProps) {
  const { t } = useI18n();

  const downloadedModel = () =>
    props.whisper.models().find((m) => m.downloaded);

  const hasTextModel = () =>
    props.textProcessing.models().some((m) => m.downloaded);

  return (
    <div class="animate-fade-in flex flex-col items-center gap-5 text-center">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 animate-scale-in">
        <FiCheck class="size-6" />
      </div>

      <div class="space-y-1.5">
        <h1 class="text-xl font-bold tracking-tight">
          {t("onboarding.completionTitle")}
        </h1>
        <p class="text-sm text-muted-foreground">
          {t("onboarding.completionSubtitle")}
        </p>
      </div>

      <div class="w-full max-w-sm space-y-1.5">
        <SummaryRow
          label={t("onboarding.summaryModel")}
          ready={!!downloadedModel()}
          readyText={downloadedModel()?.name ?? ""}
        />
        <SummaryRow
          label={t("onboarding.summaryFfmpeg")}
          ready={props.ffmpeg.isBundled()}
          readyText={t("onboarding.summaryReady")}
        />
        <SummaryRow
          label={t("onboarding.summaryLlm")}
          ready={hasTextModel()}
          readyText={t("onboarding.summaryReady")}
        />
      </div>

      <Button class="mt-1 animate-pulse-glow" onClick={props.onComplete}>
        {t("onboarding.startTranscribing")}
      </Button>
    </div>
  );
}
