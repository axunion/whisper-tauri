import { FiRefreshCw } from "solid-icons/fi";
import { createSignal, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  FileSelector,
  ModelSelector,
  ResultViewer,
  TranscriptionProgress,
} from "~/components/transcription";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createFileConverter } from "~/primitives/createFileConverter";
import { createHistory } from "~/primitives/createHistory";
import { createWhisper } from "~/primitives/createWhisper";

/** File extensions that need conversion (non-WAV). */
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

  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);

  onMount(() => {
    whisper.loadModels();
  });

  const needsConversion = () => {
    const f = whisper.file();
    if (!f) return false;
    const ext = getExtension(f.name);
    return !WAV_EXTENSIONS.has(ext);
  };

  const canStart = () =>
    whisper.file() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing() &&
    !converter.isConverting();

  const combinedError = () => whisper.error() ?? converter.error();

  function clearAllErrors() {
    whisper.clearError();
    converter.clearError();
  }

  async function handleStart() {
    const currentFile = whisper.file();
    if (!currentFile || !canStart()) return;

    // Clean up previous converted file
    const prevConverted = convertedPath();
    if (prevConverted) {
      await converter.cleanup(prevConverted);
      setConvertedPath(null);
    }

    if (needsConversion()) {
      // Convert file (Rust side resolves ffmpeg: bundled → system PATH)
      const result = await converter.convert(currentFile.path);
      if (!result) return;

      setConvertedPath(result.outputPath);
      await whisper.startTranscription(result.outputPath);
    } else {
      await whisper.startTranscription();
    }

    // Auto-save to history
    const transcriptionResult = whisper.result();
    const currentModel = whisper.selectedModel();
    if (transcriptionResult && currentModel) {
      toast.success(t("transcription.completedToast"));
      history.saveEntry({
        fileName: currentFile.name,
        language: transcriptionResult.language,
        modelId: currentModel.id,
        duration: transcriptionResult.duration,
        text: transcriptionResult.text,
        segments: transcriptionResult.segments,
      });
    }
  }

  async function handleReset() {
    // Cleanup converted file
    const prev = convertedPath();
    if (prev) {
      await converter.cleanup(prev);
      setConvertedPath(null);
    }
    whisper.reset();
  }

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      <h1 class="text-2xl font-bold">{t("transcription.title")}</h1>

      <ErrorDisplay
        error={combinedError()}
        onDismiss={clearAllErrors}
        onRetry={canStart() ? handleStart : undefined}
      />

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>{t("transcription.audioFile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FileSelector
            file={whisper.file()}
            onFileSelect={(file) => whisper.setFile(file)}
            onFileClear={() => whisper.setFile(null)}
            disabled={whisper.isProcessing() || converter.isConverting()}
          />
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

      {/* Conversion progress */}
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

      {/* Transcription progress */}
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
          !whisper.result() &&
          !whisper.isProcessing() &&
          !converter.isConverting()
        }
      >
        <Button
          class="w-full"
          size="lg"
          disabled={!canStart()}
          onClick={handleStart}
        >
          {t("transcription.startTranscription")}
        </Button>
      </Show>

      <Show when={whisper.result()}>
        {(result) => (
          <Card class="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <ResultViewer result={result()} />
              <div class="flex gap-3">
                <Button variant="outline" onClick={handleReset}>
                  {t("transcription.newFile")}
                </Button>
                <Button variant="outline" onClick={handleStart}>
                  <FiRefreshCw class="size-4" />
                  {t("transcription.rerun")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Show>
    </div>
  );
}
