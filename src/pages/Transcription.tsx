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
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { createFileConverter } from "~/primitives/createFileConverter";
import { createHistory } from "~/primitives/createHistory";
import { createRecording } from "~/primitives/createRecording";
import { createSettings } from "~/primitives/createSettings";
import { createWhisper } from "~/primitives/createWhisper";

const WAV_EXTENSIONS = new Set(["wav"]);

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return (parts.length > 1 ? parts[parts.length - 1] : "")?.toLowerCase() ?? "";
}

export default function Transcription() {
  const { t } = useI18n();

  const whisper = createWhisper();
  const converter = createFileConverter();
  const history = createHistory();
  const recording = createRecording();
  const settings = createSettings();

  const location = useLocation<{ filePath?: string; tab?: string }>();

  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal("file");
  const [historyId, setHistoryId] = createSignal<string | null>(null);

  onMount(async () => {
    whisper.loadModels();
    recording.loadDevices();
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
        if (state?.tab === "record") {
          setActiveTab("record");
        }
      },
    ),
  );

  const needsConversion = () => {
    const f = whisper.file();
    if (!f) return false;
    const ext = getExtension(f.name);
    return !WAV_EXTENSIONS.has(ext);
  };

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

  const canStartFile = () =>
    whisper.file() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing() &&
    !converter.isConverting();

  const canStartRecording = () =>
    recording.tempFilePath() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing();

  const errors = combineErrorProviders([whisper, converter, recording]);

  async function handleStartFile() {
    const currentFile = whisper.file();
    if (!currentFile || !canStartFile()) return;

    const prevConverted = convertedPath();
    if (prevConverted) {
      await converter.cleanup(prevConverted);
      setConvertedPath(null);
    }

    if (needsConversion()) {
      const result = await converter.convert(currentFile.path);
      if (!result) return;

      setConvertedPath(result.outputPath);
      await whisper.startTranscription(result.outputPath);
    } else {
      await whisper.startTranscription();
    }

    await saveToHistory(currentFile.name);
  }

  async function handleStartRecording() {
    const tempPath = recording.tempFilePath();
    if (!tempPath || !canStartRecording()) return;

    whisper.setFile({ path: tempPath, name: t("recording.title"), size: 0 });
    await whisper.startTranscription(tempPath);

    await saveToHistory(t("recording.title"));

    await recording.cleanup();
  }

  async function saveToHistory(fileName: string) {
    const transcriptionResult = whisper.result();
    const currentModel = whisper.selectedModel();
    if (transcriptionResult && currentModel) {
      toast.success(t("transcription.completedToast"));
      const id = await history.saveEntry({
        fileName,
        language: transcriptionResult.language,
        modelId: currentModel.id,
        duration: transcriptionResult.duration,
        text: transcriptionResult.text,
        segments: transcriptionResult.segments,
        vadEnabled: settings.vadEnabled(),
      });
      if (id) setHistoryId(id);
    }
  }

  async function handleDiscardRecording() {
    await recording.cleanup();
    whisper.reset();
  }

  async function handleReset() {
    const prev = convertedPath();
    if (prev) {
      await converter.cleanup(prev);
      setConvertedPath(null);
    }
    whisper.reset();
  }

  const viewState = createMemo(
    (): "input" | "converting" | "processing" | "result" => {
      if (whisper.result()) return "result";
      if (whisper.isProcessing()) return "processing";
      if (converter.isConverting()) return "converting";
      return "input";
    },
  );

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
        onRetry={canStartFile() ? handleStartFile : undefined}
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
                  onChange={setActiveTab}
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
                        disabled={
                          whisper.isProcessing() || converter.isConverting()
                        }
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
                        onDiscard={handleDiscardRecording}
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
                      canStart={
                        activeTab() === "file"
                          ? canStartFile()
                          : canStartRecording()
                      }
                      onSelectModel={(model) => whisper.selectModel(model)}
                      onLanguageChange={(lang) => {
                        whisper.setLanguage(lang);
                        settings.update({ whisperLanguage: lang });
                      }}
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
                    historyId={historyId()}
                    onClose={handleReset}
                    onRename={(id, name) => history.renameEntry(id, name)}
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
