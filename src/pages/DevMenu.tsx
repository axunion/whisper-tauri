import { onMount, Show } from "solid-js";
import {
  CacheClear,
  DebugLog,
  LlmTester,
  ModelManager,
} from "~/components/dev";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { TextModelManager } from "~/components/text-processing";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createDevLog } from "~/primitives/createDevLog";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createHistory } from "~/primitives/createHistory";
import { createSettings } from "~/primitives/createSettings";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import { createWhisper } from "~/primitives/createWhisper";

function DevMenuContent() {
  const { t } = useI18n();
  const devLog = createDevLog();
  const settings = createSettings();
  const whisper = createWhisper();
  const history = createHistory();
  const ffmpeg = createFfmpegDownloader();
  const textProcessing = createTextProcessing();

  onMount(() => {
    settings.load();
    whisper.loadModels();
    history.loadEntries();
    ffmpeg.checkStatus();
    textProcessing.loadModels();
    textProcessing.checkServer();
  });

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      {/* Cache Clear */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dev.cachesClear")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CacheClear history={history} settings={settings} ffmpeg={ffmpeg} />
        </CardContent>
      </Card>

      {/* Audio Model Manager */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dev.audioModelManager")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelManager whisper={whisper} />
        </CardContent>
      </Card>

      {/* Text Model Management */}
      <TextModelManager />

      {/* FFmpeg Manager */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dev.ffmpegManager")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between rounded-lg border p-3">
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
                      class="min-w-[8rem]"
                      onClick={async () => {
                        await ffmpeg.download();
                        toast.success(t("settings.ffmpegDownloadedToast"));
                      }}
                    >
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
                class="min-w-[8rem]"
                onClick={async () => {
                  await ffmpeg.deleteBundled();
                  toast.success(t("dev.ffmpegDeletedToast"));
                }}
              >
                {t("common.delete")}
              </Button>
            </Show>
          </div>
        </CardContent>
      </Card>

      {/* LLM Tester */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dev.llmTester")}</CardTitle>
          <p class="text-sm text-muted-foreground">
            {t("dev.llmTesterDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <LlmTester textProcessing={textProcessing} />
        </CardContent>
      </Card>

      {/* Debug Log */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dev.debugLog")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DebugLog devLog={devLog} />
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
