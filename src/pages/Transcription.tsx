import { FiRefreshCw } from "solid-icons/fi";
import { createMemo, createSignal, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  FileSelector,
  RecordingPanel,
  ResultViewer,
  TranscriptionProgress,
} from "~/components/transcription";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createFileConverter } from "~/primitives/createFileConverter";
import { createHistory } from "~/primitives/createHistory";
import { createRecording } from "~/primitives/createRecording";
import { createSettings } from "~/primitives/createSettings";
import { createWhisper } from "~/primitives/createWhisper";
import type { ModelInfo } from "~/types";

const WAV_EXTENSIONS = new Set(["wav"]);

interface LanguageOption {
  value: string;
  label: string;
}

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return (parts.length > 1 ? parts[parts.length - 1] : "")?.toLowerCase() ?? "";
}

export default function Transcription() {
  const { t } = useI18n();

  const languageOptions: LanguageOption[] = [
    { value: "auto", label: t("transcription.languageAuto") },
    { value: "ja", label: t("transcription.languageJa") },
    { value: "en", label: t("transcription.languageEn") },
    { value: "zh", label: t("transcription.languageZh") },
    { value: "ko", label: t("transcription.languageKo") },
    { value: "fr", label: t("transcription.languageFr") },
    { value: "de", label: t("transcription.languageDe") },
    { value: "es", label: t("transcription.languageEs") },
  ];

  const whisper = createWhisper();
  const converter = createFileConverter();
  const history = createHistory();
  const recording = createRecording();
  const settings = createSettings();

  const [convertedPath, setConvertedPath] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal("file");

  onMount(async () => {
    whisper.loadModels();
    recording.loadDevices();
    await settings.load();
    const saved = settings.whisperLanguage();
    if (saved !== undefined) {
      whisper.setLanguage(saved);
    }
  });

  const needsConversion = () => {
    const f = whisper.file();
    if (!f) return false;
    const ext = getExtension(f.name);
    return !WAV_EXTENSIONS.has(ext);
  };

  const downloadedModels = createMemo(() =>
    whisper.models().filter((m) => m.downloaded),
  );

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
        <CardContent class="pt-6">
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
              <div class="flex h-[176px] flex-col justify-center">
                <FileSelector
                  file={whisper.file()}
                  onFileSelect={(file) => whisper.setFile(file)}
                  onFileClear={() => whisper.setFile(null)}
                  disabled={whisper.isProcessing() || converter.isConverting()}
                />
              </div>
            </TabsContent>
            <TabsContent value="record">
              <div
                class={
                  recording.tempFilePath() !== null
                    ? "flex h-[176px] flex-col"
                    : "flex h-[280px] flex-col"
                }
              >
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

          <Show
            when={
              !whisper.result() &&
              !whisper.isProcessing() &&
              !converter.isConverting() &&
              !recording.isRecording()
            }
          >
            <Show
              when={activeTab() === "file" || recording.tempFilePath() !== null}
            >
              <div class="mt-6 border-t border-border/30 pt-5">
                <Show
                  when={downloadedModels().length > 0}
                  fallback={
                    <p class="rounded-lg bg-muted/50 py-3 text-center text-sm text-muted-foreground">
                      {t("transcription.noModelsWarning")}
                    </p>
                  }
                >
                  <div class="grid grid-cols-[2fr_2fr_3fr] gap-3">
                    <div class="space-y-3">
                      <span class="text-xs font-medium text-muted-foreground">
                        {t("transcription.model")}
                      </span>
                      <Select<ModelInfo>
                        multiple={false}
                        options={downloadedModels()}
                        optionValue="id"
                        optionTextValue="name"
                        value={whisper.selectedModel()}
                        onChange={(value) => {
                          if (value) whisper.selectModel(value);
                        }}
                        disallowEmptySelection
                        itemComponent={(itemProps) => (
                          <SelectItem item={itemProps.item}>
                            {itemProps.item.rawValue.name}
                          </SelectItem>
                        )}
                      >
                        <SelectTrigger class="h-11 border-0 bg-muted/50">
                          <SelectValue<ModelInfo>>
                            {(state) =>
                              state.selectedOption()?.name ??
                              t("transcription.model")
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                    </div>
                    <div class="space-y-3">
                      <span class="text-xs font-medium text-muted-foreground">
                        {t("transcription.languageLabel")}
                      </span>
                      <Select<LanguageOption>
                        multiple={false}
                        options={languageOptions}
                        optionValue="value"
                        optionTextValue="label"
                        value={
                          languageOptions.find(
                            (o) => o.value === (whisper.language() ?? "auto"),
                          ) ??
                          languageOptions[0] ??
                          null
                        }
                        onChange={(value) => {
                          if (value) {
                            const lang =
                              value.value === "auto" ? null : value.value;
                            whisper.setLanguage(lang);
                            settings.update({ whisperLanguage: lang });
                          }
                        }}
                        disallowEmptySelection
                        itemComponent={(itemProps) => (
                          <SelectItem item={itemProps.item}>
                            {itemProps.item.rawValue.label}
                          </SelectItem>
                        )}
                      >
                        <SelectTrigger class="h-11 border-0 bg-muted/50">
                          <SelectValue<LanguageOption>>
                            {(state) =>
                              state.selectedOption()?.label ??
                              t("transcription.languageAuto")
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                    </div>
                    <div class="flex items-end">
                      <Button
                        class="h-11 w-full"
                        disabled={
                          activeTab() === "file"
                            ? !canStartFile()
                            : !canStartRecording()
                        }
                        onClick={
                          activeTab() === "file"
                            ? handleStartFile
                            : handleStartRecording
                        }
                      >
                        {t("transcription.startTranscription")}
                      </Button>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </Show>
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
