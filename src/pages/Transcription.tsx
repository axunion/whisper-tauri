import { useLocation } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  FileSelector,
  RecordingPanel,
  TranscriptionOptionsBar,
  TranscriptionProgress,
  TranscriptionResult,
} from "~/components/transcription";
import { Card, CardContent } from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { useI18n } from "~/i18n";
import { extractFilename } from "~/lib/constants";
import { combineErrorProviders } from "~/lib/errors";
import { formatLocalDateTime } from "~/lib/format";
import { cn } from "~/lib/utils";
import { createHistory } from "~/primitives/createHistory";
import { createRecording } from "~/primitives/createRecording";
import { createSettings } from "~/primitives/createSettings";
import {
  type AudioSource,
  createTranscriptionJob,
} from "~/primitives/createTranscriptionJob";
import { createWhisper } from "~/primitives/createWhisper";

export default function Transcription() {
  const { t } = useI18n();

  const whisper = createWhisper();
  const job = createTranscriptionJob();
  const history = createHistory();
  const recording = createRecording();
  const settings = createSettings();

  const location = useLocation<{
    filePath?: string;
    tab?: string;
    retranscribe?: AudioSource;
  }>();

  const [activeTab, setActiveTab] = createSignal("file");

  // Device enumeration walks CoreAudio inputs, and the list genuinely changes
  // when a mic is plugged in, so it runs on entry to the record tab instead of
  // at page mount — file-only users never pay for it.
  function activateTab(tab: string): void {
    setActiveTab(tab);
    if (tab === "record") {
      recording.loadDevices();
    }
  }

  onMount(async () => {
    whisper.loadModels();
    await settings.load();
    const saved = settings.whisperLanguage();
    if (saved !== undefined) {
      whisper.setLanguage(saved);
    }
  });

  createEffect(
    on(
      () => location.state,
      (state) => {
        if (state?.filePath) {
          const path = state.filePath;
          whisper.selectFile({ path, name: extractFilename(path), size: 0 });
        }
        if (state?.retranscribe) {
          void job.prepareRetranscription(state.retranscribe);
        }
        if (state?.tab === "record") {
          activateTab("record");
        }
      },
    ),
  );

  const downloadedModels = createMemo(() =>
    whisper.models().filter((m) => m.downloaded),
  );

  const estimatedTotalSec = createMemo(() => {
    const f = whisper.file();
    const model = whisper.selectedModel();
    if (!f?.duration || !model || model.speedSecondsPerMinuteHigh === 0)
      return undefined;
    const audioMinutes = f.duration / 60_000;
    // Use midpoint between low and high for a realistic estimate
    const speedPerMin =
      (model.speedSecondsPerMinuteLow + model.speedSecondsPerMinuteHigh) / 2;
    return audioMinutes * speedPerMin;
  });

  const estimateLabel = createMemo(() => {
    const sec = estimatedTotalSec();
    if (sec === undefined) return undefined;
    return t("transcription.estimatedTime", {
      minutes: Math.max(1, Math.ceil(sec / 60)),
    });
  });

  // `history` is here for a failed rename of the result's entry.
  const errors = combineErrorProviders([whisper, job, recording, history]);

  const completedMessage = () => t("transcription.completedToast");

  function handleStartFile() {
    history.clearError();
    return job.startFile({ completedMessage: completedMessage() });
  }

  function handleStartRecording() {
    history.clearError();
    return job.startRecording({
      // Dated so recordings stay distinguishable in the history list.
      name: `${t("recording.title")} ${formatLocalDateTime(new Date())}`,
      completedMessage: completedMessage(),
    });
  }

  const retryHandler = () => {
    // Retry re-runs the transcription, which fixes none of a failed history
    // save, a failed audio attach or a failed rename.
    if (job.saveFailed() || job.attachFailed() || history.error()) {
      return undefined;
    }
    if (activeTab() === "file") {
      return job.canStartFile() ? handleStartFile : undefined;
    }
    return job.canStartRecording() ? handleStartRecording : undefined;
  };

  const viewState = createMemo(() => {
    const phase = job.phase();
    return phase === "done" ? "result" : phase === "idle" ? "input" : phase;
  });

  return (
    <div
      class={cn(
        "animate-fade-in mx-auto w-full max-w-3xl",
        viewState() === "result"
          ? "flex min-h-0 flex-1 flex-col gap-8"
          : "space-y-8",
      )}
    >
      <ErrorDisplay
        error={errors.error()}
        onDismiss={errors.clearAll}
        onRetry={retryHandler()}
      />

      <Card
        class={cn(
          "rounded-2xl shadow-sm",
          viewState() === "result" && "flex min-h-0 flex-1 flex-col",
        )}
      >
        <CardContent
          class={cn(
            "pt-6",
            viewState() === "result" && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <Switch>
            <Match when={viewState() === "input"}>
              <div class="flex h-93 flex-col">
                <Tabs
                  value={activeTab()}
                  onChange={activateTab}
                  class="flex flex-1 flex-col"
                >
                  <TabsList class="w-full">
                    <TabsTrigger
                      value="file"
                      class="flex-1"
                      disabled={recording.isRecording()}
                    >
                      {t("recording.fileTab")}
                    </TabsTrigger>
                    <TabsTrigger value="record" class="flex-1">
                      {t("recording.recordTab")}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="file" class="flex-1">
                    <div class="flex h-full flex-col justify-center">
                      <FileSelector
                        file={whisper.file()}
                        estimateLabel={estimateLabel()}
                        onFileSelect={(file) => whisper.selectFile(file)}
                        onFileClear={() => whisper.setFile(null)}
                        disabled={job.phase() !== "idle"}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="record" class="flex-1">
                    <div class="flex h-full flex-col">
                      <RecordingPanel
                        devices={recording.devices()}
                        selectedDevice={recording.selectedDevice()}
                        isRecording={recording.isRecording()}
                        level={recording.level()}
                        duration={recording.duration()}
                        tempFilePath={recording.tempFilePath()}
                        disabled={whisper.isProcessing()}
                        onSelectDevice={(d) => recording.selectDevice(d)}
                        onStartRecording={() => recording.startRecording()}
                        onStopRecording={() => recording.stopRecording()}
                        onDiscard={job.discardRecording}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <Show when={!recording.isRecording()}>
                  <Show
                    when={
                      activeTab() === "file" ||
                      recording.tempFilePath() !== null
                    }
                  >
                    <TranscriptionOptionsBar
                      downloadedModels={downloadedModels()}
                      selectedModel={whisper.selectedModel()}
                      language={whisper.language()}
                      vadEnabled={whisper.vadEnabled()}
                      canStart={
                        activeTab() === "file"
                          ? job.canStartFile()
                          : job.canStartRecording()
                      }
                      onSelectModel={(model) => whisper.selectModel(model)}
                      onLanguageChange={(lang) => {
                        whisper.setLanguage(lang);
                        settings.update({ whisperLanguage: lang });
                      }}
                      onVadChange={whisper.setVadEnabled}
                      onStart={
                        activeTab() === "file"
                          ? handleStartFile
                          : handleStartRecording
                      }
                    />
                  </Show>
                </Show>
              </div>
            </Match>

            <Match when={viewState() === "converting"}>
              <div class="flex h-93 flex-col justify-center space-y-6">
                <Show when={whisper.file()}>
                  {(file) => (
                    <p class="text-center text-sm text-muted-foreground">
                      {file().name}
                    </p>
                  )}
                </Show>
                <Progress indeterminate minValue={0} maxValue={100} />
                <p class="text-center text-sm font-medium">
                  {t("transcription.converting")}
                </p>
              </div>
            </Match>

            <Match when={viewState() === "processing"}>
              <div class="flex h-93 flex-col justify-center space-y-6">
                <Show when={whisper.file()}>
                  {(file) => (
                    <p class="text-center text-sm text-muted-foreground">
                      {file().name}
                    </p>
                  )}
                </Show>
                <TranscriptionProgress
                  progress={whisper.progress()}
                  estimatedTotalSec={estimatedTotalSec()}
                  onCancel={() => whisper.cancelTranscription()}
                />
              </div>
            </Match>

            <Match when={viewState() === "result"}>
              <Show when={whisper.result()}>
                {(result) => (
                  <TranscriptionResult
                    result={result()}
                    fileName={whisper.file()?.name ?? ""}
                    historyId={job.historyId()}
                    onClose={job.reset}
                    onRename={(id, name) => history.renameEntry(id, name)}
                    notionMeta={{
                      createdAt: whisper.transcribedAt() ?? undefined,
                      modelId: whisper.selectedModel()?.id,
                      processingMs: whisper.processingMs() ?? undefined,
                      vadEnabled: whisper.vadEnabled(),
                    }}
                  />
                )}
              </Show>
            </Match>
          </Switch>
        </CardContent>
      </Card>
    </div>
  );
}
