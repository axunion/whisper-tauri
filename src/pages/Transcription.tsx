import { FiRefreshCw } from "solid-icons/fi";
import { createSignal, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  FileSelector,
  ModelSelector,
  RecordingPanel,
  ResultViewer,
  TranscriptionProgress,
} from "~/components/transcription";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createFileConverter } from "~/primitives/createFileConverter";
import { createHistory } from "~/primitives/createHistory";
import { createRecording } from "~/primitives/createRecording";
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

  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal("file");

  onMount(() => {
    whisper.loadModels();
    recording.loadDevices();
  });

  const needsConversion = () => {
    const f = whisper.file();
    if (!f) return false;
    const ext = getExtension(f.name);
    return !WAV_EXTENSIONS.has(ext);
  };

  const canStartFile = () =>
    whisper.file() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing() &&
    !converter.isConverting();

  const canStartRecording = () =>
    recording.tempFilePath() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing();

  const combinedError = () =>
    whisper.error() ?? converter.error() ?? recording.error();

  function clearAllErrors() {
    whisper.clearError();
    converter.clearError();
    recording.clearError();
  }

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
      history.saveEntry({
        fileName,
        language: transcriptionResult.language,
        modelId: currentModel.id,
        duration: transcriptionResult.duration,
        text: transcriptionResult.text,
        segments: transcriptionResult.segments,
      });
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

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-8">
      <h1 class="text-2xl font-bold">{t("transcription.title")}</h1>

      <ErrorDisplay
        error={combinedError()}
        onDismiss={clearAllErrors}
        onRetry={canStartFile() ? handleStartFile : undefined}
      />

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>{t("transcription.audioFile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab()} onChange={setActiveTab}>
            <TabsList class="w-full">
              <TabsTrigger value="file" class="flex-1">
                {t("recording.fileTab")}
              </TabsTrigger>
              <TabsTrigger value="record" class="flex-1">
                {t("recording.recordTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <FileSelector
                file={whisper.file()}
                onFileSelect={(file) => whisper.setFile(file)}
                onFileClear={() => whisper.setFile(null)}
                disabled={whisper.isProcessing() || converter.isConverting()}
              />
            </TabsContent>
            <TabsContent value="record">
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
                onTranscribe={handleStartRecording}
                onDiscard={handleDiscardRecording}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>{t("transcription.model")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelSelector
            models={whisper.models()}
            selectedModel={whisper.selectedModel()}
            downloadProgress={whisper.downloadProgress()}
            isDownloading={whisper.isDownloading()}
            onSelectModel={(model) => whisper.selectModel(model)}
            onDownloadModel={(modelId) => whisper.downloadModel(modelId)}
          />
        </CardContent>
      </Card>

      <Show when={converter.isConverting()}>
        <Card class="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t("transcription.converting")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress indeterminate minValue={0} maxValue={100} />
          </CardContent>
        </Card>
      </Show>

      <Show when={whisper.isProcessing()}>
        <Card class="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t("transcription.transcribing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TranscriptionProgress
              progress={whisper.progress()}
              onCancel={() => whisper.cancelTranscription()}
            />
          </CardContent>
        </Card>
      </Show>

      <Show
        when={
          activeTab() === "file" &&
          !whisper.result() &&
          !whisper.isProcessing() &&
          !converter.isConverting()
        }
      >
        <div class="flex justify-center">
          <Button
            class="px-16"
            size="lg"
            disabled={!canStartFile()}
            onClick={handleStartFile}
          >
            {t("transcription.startTranscription")}
          </Button>
        </div>
      </Show>

      <Show when={whisper.result()}>
        {(result) => (
          <Card class="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
              <ResultViewer result={result()} />
              <div class="flex gap-3">
                <Button variant="outline" onClick={handleReset}>
                  {t("transcription.newFile")}
                </Button>
                <Show when={activeTab() === "file"}>
                  <Button variant="outline" onClick={handleStartFile}>
                    <FiRefreshCw class="size-4" />
                    {t("transcription.rerun")}
                  </Button>
                </Show>
              </div>
            </CardContent>
          </Card>
        )}
      </Show>
    </div>
  );
}
