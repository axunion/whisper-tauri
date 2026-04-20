import {
  FiMessageSquare,
  FiMusic,
  FiRefreshCw,
  FiRotateCcw,
  FiTool,
} from "solid-icons/fi";
import { onMount, Show } from "solid-js";
import { CacheClear, LlmTester } from "~/components/dev";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { TextModelManager } from "~/components/text-processing";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { FfmpegControl } from "~/components/ui/FfmpegControl";
import { WhisperModelList } from "~/components/ui/WhisperModelList";
import { useI18n } from "~/i18n";
import { combineErrorProviders } from "~/lib/errors";
import { toast } from "~/lib/toast";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createHistory } from "~/primitives/createHistory";
import { createSettings } from "~/primitives/createSettings";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import { createWhisper } from "~/primitives/createWhisper";

function DevMenuContent() {
  const { t } = useI18n();
  const whisper = createWhisper();
  const history = createHistory();
  const ffmpeg = createFfmpegDownloader();
  const textProcessing = createTextProcessing();
  const devSettings = createSettings();

  const errors = combineErrorProviders([
    whisper,
    history,
    ffmpeg,
    textProcessing,
  ]);

  onMount(() => {
    whisper.loadModels();
    history.loadEntries();
    ffmpeg.checkStatus();
  });

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      {/* Audio Model Manager */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiMusic class="size-4" />}>
            {t("settings.modelManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent>
          <WhisperModelList
            whisper={whisper}
            labels={{
              deletedToast: "dev.modelDeletedToast",
              deleteTitle: "dev.deleteModel",
              deleteDescription: "dev.deleteModelConfirmation",
              emptyState: "dev.noDownloadedModels",
            }}
          />
        </CardContent>
      </Card>

      {/* Text Model Management */}
      <TextModelManager devMode textProcessing={textProcessing} />

      {/* LLM Tester */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiMessageSquare class="size-4" />}>
            {t("dev.llmTester")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent>
          <LlmTester textProcessing={textProcessing} />
        </CardContent>
      </Card>

      {/* FFmpeg Manager */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiTool class="size-4" />}>
            {t("settings.toolManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent>
          <FfmpegControl
            ffmpeg={ffmpeg}
            labels={{
              deleteTitle: "dev.deleteFfmpeg",
              deleteDescription: "dev.deleteFfmpegConfirmation",
              deletedToast: "dev.ffmpegDeletedToast",
              downloadedToast: "settings.ffmpegDownloadedToast",
            }}
          />
        </CardContent>
      </Card>

      {/* Data Reset */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiRefreshCw class="size-4" />}>
            {t("dev.dataReset")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent class="space-y-4">
          <CacheClear history={history} />
          <div class="flex items-center justify-between rounded-lg border p-4">
            <span class="text-sm font-medium">{t("dev.resetOnboarding")}</span>
            <ConfirmDialog
              title={t("dev.resetOnboardingConfirmTitle")}
              description={t("dev.resetOnboardingConfirmDescription")}
              confirmLabel={
                <>
                  <FiRotateCcw />
                  {t("dev.reset")}
                </>
              }
              onConfirm={async () => {
                await devSettings.update({ onboardingCompleted: false });
                toast.success(t("dev.onboardingResetToast"));
              }}
            >
              {(openDialog) => (
                <Button
                  variant="secondary"
                  size="sm"
                  class="w-28"
                  onClick={openDialog}
                >
                  <FiRotateCcw />
                  {t("dev.reset")}
                </Button>
              )}
            </ConfirmDialog>
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      <ErrorDisplay error={errors.error()} onDismiss={errors.clearAll} />
    </div>
  );
}

export default function DevMenu() {
  const { t } = useI18n();
  return (
    <Show
      when={import.meta.env.DEV}
      fallback={
        <div class="mx-auto w-full max-w-3xl">
          <p class="text-muted-foreground">{t("dev.devOnlyMessage")}</p>
        </div>
      }
    >
      <DevMenuContent />
    </Show>
  );
}
