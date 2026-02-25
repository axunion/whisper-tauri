import { onMount, Show } from "solid-js";
import { CacheClear, DebugLog, ModelManager } from "~/components/dev";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { createDevLog } from "~/primitives/createDevLog";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createHistory } from "~/primitives/createHistory";
import { createSettings } from "~/primitives/createSettings";
import { createWhisper } from "~/primitives/createWhisper";

function DevMenuContent() {
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
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <h1 class="text-2xl font-bold">Dev Menu</h1>

      {/* Cache Clear */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Clear</CardTitle>
        </CardHeader>
        <CardContent>
          <CacheClear history={history} settings={settings} ffmpeg={ffmpeg} />
        </CardContent>
      </Card>

      {/* Model Manager */}
      <Card>
        <CardHeader>
          <CardTitle>Model Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelManager whisper={whisper} />
        </CardContent>
      </Card>

      {/* Debug Log */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Log</CardTitle>
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
  return (
    <Show
      when={import.meta.env.DEV}
      fallback={
        <div class="mx-auto w-full max-w-3xl">
          <p class="text-muted-foreground">
            This page is only available in development mode.
          </p>
        </div>
      }
    >
      <DevMenuContent />
    </Show>
  );
}
