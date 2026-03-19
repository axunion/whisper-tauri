import {
  FiDownload,
  FiMessageSquare,
  FiMusic,
  FiRefreshCw,
  FiRotateCcw,
  FiTool,
  FiTrash2,
} from "solid-icons/fi";
import { onMount, Show } from "solid-js";
import { CacheClear, LlmTester, ModelManager } from "~/components/dev";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { TextModelManager } from "~/components/text-processing";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
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
          <ModelManager whisper={whisper} />
        </CardContent>
      </Card>

      {/* Text Model Management */}
      <TextModelManager devMode textProcessing={textProcessing} />

      {/* FFmpeg Manager */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiTool class="size-4" />}>
            {t("settings.toolManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">FFmpeg</span>
              <Show when={ffmpeg.isSystemAvailable()}>
                <Badge variant="secondary">
                  {t("settings.systemInstalled")}
                </Badge>
              </Show>
              <Show when={ffmpeg.isBundled()}>
                <Badge variant="outline">{t("dashboard.downloaded")}</Badge>
              </Show>
            </div>
            <Show
              when={ffmpeg.isBundled()}
              fallback={
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
              }
            >
              <Button
                variant="destructive"
                size="sm"
                class="w-28"
                onClick={async () => {
                  await ffmpeg.deleteBundled();
                  toast.success(t("dev.ffmpegDeletedToast"));
                }}
              >
                <FiTrash2 />
                {t("common.delete")}
              </Button>
            </Show>
          </div>
        </CardContent>
      </Card>

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
            <Button
              variant="outline"
              size="sm"
              class="w-28"
              onClick={async () => {
                await devSettings.update({ onboardingCompleted: false });
                toast.success(t("dev.onboardingResetToast"));
              }}
            >
              <FiRotateCcw />
              {t("dev.reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      <ErrorDisplay
        error={
          whisper.error() ??
          history.error() ??
          ffmpeg.error() ??
          textProcessing.error()
        }
        onDismiss={() => {
          whisper.clearError();
          history.clearError();
          ffmpeg.clearError();
          textProcessing.clearError();
        }}
      />
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
