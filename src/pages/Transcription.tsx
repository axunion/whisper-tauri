import { FiRefreshCw, FiX } from "solid-icons/fi";
import { onMount, Show } from "solid-js";
import {
  FileSelector,
  ModelSelector,
  ResultViewer,
  TranscriptionProgress,
} from "~/components/transcription";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { createWhisper } from "~/primitives/createWhisper";

export default function Transcription() {
  const whisper = createWhisper();

  onMount(() => {
    whisper.loadModels();
  });

  const canStart = () =>
    whisper.file() !== null &&
    whisper.selectedModel() !== null &&
    !whisper.isProcessing();

  return (
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <h1 class="text-2xl font-bold">Transcription</h1>

      <Show when={whisper.error()}>
        {(error) => (
          <div class="flex items-center justify-between rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>{error()}</span>
            <button
              type="button"
              class="ml-2 shrink-0 text-destructive hover:text-destructive/80"
              onClick={() => whisper.clearError()}
            >
              <FiX class="size-4" />
            </button>
          </div>
        )}
      </Show>

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Audio File</CardTitle>
        </CardHeader>
        <CardContent>
          <FileSelector
            file={whisper.file()}
            onFileSelect={(file) => whisper.setFile(file)}
            onFileClear={() => whisper.setFile(null)}
            disabled={whisper.isProcessing()}
          />
        </CardContent>
      </Card>

      <Card class="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Model</CardTitle>
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

      <Show when={whisper.isProcessing()}>
        <Card class="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Transcribing...</CardTitle>
          </CardHeader>
          <CardContent>
            <TranscriptionProgress
              progress={whisper.progress()}
              onCancel={() => whisper.cancelTranscription()}
            />
          </CardContent>
        </Card>
      </Show>

      <Show when={!whisper.result() && !whisper.isProcessing()}>
        <Button
          class="w-full"
          size="lg"
          disabled={!canStart()}
          onClick={() => whisper.startTranscription()}
        >
          Start Transcription
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
                <Button variant="outline" onClick={() => whisper.reset()}>
                  New File
                </Button>
                <Button
                  variant="outline"
                  onClick={() => whisper.startTranscription()}
                >
                  <FiRefreshCw class="size-4" />
                  Re-run
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Show>
    </div>
  );
}
