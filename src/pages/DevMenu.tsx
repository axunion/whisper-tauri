import { onMount, Show } from "solid-js";
import { CacheClear, DebugLog, ModelManager } from "~/components/dev";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { useI18n } from "~/i18n";
import { createDevLog } from "~/primitives/createDevLog";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createHistory } from "~/primitives/createHistory";
import { createSettings } from "~/primitives/createSettings";
import { createWhisper } from "~/primitives/createWhisper";

function DevMenuContent() {
  const { t } = useI18n();
  const devLog = createDevLog();
  const settings = createSettings();
  const whisper = createWhisper();
  const history = createHistory();
  const ffmpeg = createFfmpegDownloader();

  onMount(() => {
    settings.load();
    whisper.loadModels();
    history.loadEntries();
    ffmpeg.checkStatus();
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

      {/* Model Manager */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dev.modelManager")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelManager whisper={whisper} />
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
        error={whisper.error() ?? history.error() ?? ffmpeg.error()}
        onDismiss={() => {
          whisper.clearError();
          history.clearError();
          ffmpeg.clearError();
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
