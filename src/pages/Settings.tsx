import { createSignal, For, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/AlertDialog";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { Label } from "~/components/ui/Label";
import { Progress } from "~/components/ui/Progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { Separator } from "~/components/ui/Separator";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import { createSettings } from "~/primitives/createSettings";
import { applyTheme } from "~/primitives/createTheme";
import { createWhisper } from "~/primitives/createWhisper";
import type { AppSettings } from "~/types";

type OptionItem = { value: string; label: string };

export default function Settings() {
  const { t, setLocale } = useI18n();
  const settings = createSettings();
  const whisper = createWhisper();
  const ffmpeg = createFfmpegDownloader();
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );

  const languageOptions = () => [
    { value: "ja", label: t("settings.languageJa") },
    { value: "en", label: t("settings.languageEn") },
  ];

  const outputFormatOptions = () => [
    { value: "txt", label: t("settings.outputFormatTxt") },
    { value: "srt", label: t("settings.outputFormatSrt") },
    { value: "vtt", label: t("settings.outputFormatVtt") },
  ];

  const themeOptions = () => [
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
    { value: "system", label: t("settings.themeSystem") },
  ];

  applyTheme(settings.theme);

  onMount(() => {
    settings.load();
    whisper.loadModels();
    ffmpeg.checkStatus();
  });

  function findOption(options: OptionItem[], value: string): OptionItem | null {
    return options.find((o) => o.value === value) ?? null;
  }

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await whisper.deleteModel(modelId);
    setDeletingModelId(null);
    toast.success(t("settings.modelDeletedToast"));
  }

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general")}</CardTitle>
          <CardDescription>{t("settings.generalDescription")}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          {/* Language */}
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{t("settings.language")}</Label>
              <p class="text-sm text-muted-foreground">
                {t("settings.languageDescription")}
              </p>
            </div>
            <Select<OptionItem>
              multiple={false}
              value={findOption(languageOptions(), settings.language())}
              onChange={(val) => {
                if (val) {
                  const lang = val.value as AppSettings["language"];
                  settings.update({ language: lang });
                  setLocale(lang);
                }
              }}
              options={languageOptions()}
              optionValue="value"
              optionTextValue="label"
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="w-48">
                <SelectValue<OptionItem>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <Separator />

          {/* Output Format */}
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{t("settings.outputFormat")}</Label>
              <p class="text-sm text-muted-foreground">
                {t("settings.outputFormatDescription")}
              </p>
            </div>
            <Select<OptionItem>
              multiple={false}
              value={findOption(outputFormatOptions(), settings.outputFormat())}
              onChange={(val) => {
                if (val) {
                  settings.update({
                    outputFormat: val.value as AppSettings["outputFormat"],
                  });
                }
              }}
              options={outputFormatOptions()}
              optionValue="value"
              optionTextValue="label"
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="w-48">
                <SelectValue<OptionItem>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <Separator />

          {/* Theme */}
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{t("settings.theme")}</Label>
              <p class="text-sm text-muted-foreground">
                {t("settings.themeDescription")}
              </p>
            </div>
            <Select<OptionItem>
              multiple={false}
              value={findOption(themeOptions(), settings.theme())}
              onChange={(val) => {
                if (val) {
                  settings.update({
                    theme: val.value as AppSettings["theme"],
                  });
                }
              }}
              options={themeOptions()}
              optionValue="value"
              optionTextValue="label"
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {props.item.rawValue.label}
                </SelectItem>
              )}
            >
              <SelectTrigger class="w-48">
                <SelectValue<OptionItem>>
                  {(state) => state.selectedOption().label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Model Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.modelManagement")}</CardTitle>
          <CardDescription>
            {t("settings.modelManagementDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <For each={whisper.models()}>
            {(model) => (
              <div class="flex items-center justify-between rounded-lg border p-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{model.name}</span>
                    <Badge variant="secondary">{model.size}</Badge>
                    <Show when={model.speedNote}>
                      <Badge variant="outline">{model.speedNote}</Badge>
                    </Show>
                    <Show when={model.recommended}>
                      <Badge>{t("common.recommended")}</Badge>
                    </Show>
                  </div>
                  <p class="text-sm text-muted-foreground">
                    {model.description}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <Show
                    when={model.downloaded}
                    fallback={
                      <Show
                        when={
                          whisper.isDownloading() &&
                          whisper.downloadProgress()?.modelId === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={() => whisper.downloadModel(model.id)}
                            disabled={whisper.isDownloading()}
                          >
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <div class="w-28 space-y-1">
                          <Progress
                            value={whisper.downloadProgress()?.progress ?? 0}
                            minValue={0}
                            maxValue={100}
                          />
                          <p class="text-center text-xs text-muted-foreground">
                            {Math.round(
                              whisper.downloadProgress()?.progress ?? 0,
                            )}
                            %
                          </p>
                        </div>
                      </Show>
                    }
                  >
                    <AlertDialog>
                      <AlertDialogTrigger
                        as={Button}
                        variant="destructive"
                        size="sm"
                        class="w-28"
                        disabled={deletingModelId() === model.id}
                      >
                        {deletingModelId() === model.id
                          ? t("common.deleting")
                          : t("common.delete")}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>
                          {t("settings.deleteModel")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("settings.deleteModelConfirmation", {
                            name: model.name,
                            size: model.size,
                          })}
                        </AlertDialogDescription>
                        <div class="flex justify-end gap-2">
                          <AlertDialogTrigger as={Button} variant="outline">
                            {t("common.cancel")}
                          </AlertDialogTrigger>
                          <Button
                            variant="destructive"
                            onClick={() => handleDeleteModel(model.id)}
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Show>
                </div>
              </div>
            )}
          </For>
          <Show when={whisper.models().length === 0}>
            <p class="text-sm text-muted-foreground">
              {t("settings.loadingModels")}
            </p>
          </Show>
        </CardContent>
      </Card>

      {/* FFmpeg */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.toolManagement")}</CardTitle>
          <CardDescription>
            {t("settings.toolManagementDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="flex items-center gap-2">
              <span class="font-medium">FFmpeg</span>
              <Show when={ffmpeg.isSystemAvailable()}>
                <Badge variant="secondary">
                  {t("settings.systemInstalled")}
                </Badge>
              </Show>
            </div>
            <Show
              when={!ffmpeg.isBundled()}
              fallback={
                <Button
                  variant="destructive"
                  size="sm"
                  class="w-28"
                  onClick={async () => {
                    await ffmpeg.deleteBundled();
                    toast.success(t("settings.ffmpegDeletedToast"));
                  }}
                >
                  {t("common.delete")}
                </Button>
              }
            >
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
            </Show>
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.resetTitle")}</CardTitle>
          <CardDescription>{t("settings.resetDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              await settings.reset();
              toast.success(t("settings.settingsResetToast"));
            }}
          >
            {t("settings.resetToDefaults")}
          </Button>
        </CardContent>
      </Card>

      {/* Error display */}
      <ErrorDisplay
        error={whisper.error()}
        onDismiss={() => whisper.clearError()}
      />
    </div>
  );
}
