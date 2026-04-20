import { FiMusic, FiSettings } from "solid-icons/fi";
import { onMount } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { FfmpegManager, SettingsSelect } from "~/components/settings";
import { TextModelManager } from "~/components/text-processing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { Checkbox } from "~/components/ui/Checkbox";
import { Separator } from "~/components/ui/Separator";
import { WhisperModelList } from "~/components/ui/WhisperModelList";
import { useI18n } from "~/i18n";
import { createSettings } from "~/primitives/createSettings";
import { applyTheme } from "~/primitives/createTheme";
import { createWhisper } from "~/primitives/createWhisper";
import type { AppSettings } from "~/types";

type OptionItem = { value: string; label: string };

export default function Settings() {
  const { t, setLocale } = useI18n();
  const settings = createSettings();
  const whisper = createWhisper();

  const languageOptions = () => [
    { value: "ja", label: t("settings.languageJa") },
    { value: "en", label: t("settings.languageEn") },
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
  });

  function findOption(options: OptionItem[], value: string): OptionItem | null {
    return options.find((o) => o.value === value) ?? null;
  }

  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiSettings class="size-4" />}>
            {t("settings.general")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent class="space-y-6">
          <SettingsSelect
            label={t("settings.language")}
            description={t("settings.languageDescription")}
            options={languageOptions()}
            value={findOption(languageOptions(), settings.language())}
            onChange={(val) => {
              const lang = val.value as AppSettings["language"];
              settings.update({ language: lang });
              setLocale(lang);
            }}
          />

          <Separator />

          <SettingsSelect
            label={t("settings.theme")}
            description={t("settings.themeDescription")}
            options={themeOptions()}
            value={findOption(themeOptions(), settings.theme())}
            onChange={(val) => {
              settings.update({
                theme: val.value as AppSettings["theme"],
              });
            }}
          />

          <Separator />

          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-sm font-medium">{t("settings.vadEnabled")}</div>
              <p class="text-sm text-muted-foreground">
                {t("settings.vadDescription")}
              </p>
            </div>
            <Checkbox
              checked={settings.vadEnabled()}
              onChange={(checked: boolean) => {
                settings.update({ vadEnabled: checked });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Whisper Model Management */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiMusic class="size-4" />}>
            {t("settings.modelManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent>
          <WhisperModelList
            whisper={whisper}
            labels={{
              deletedToast: "settings.modelDeletedToast",
              deleteTitle: "settings.deleteModel",
              deleteDescription: "settings.deleteModelConfirmation",
              emptyState: "settings.loadingModels",
            }}
          />
        </CardContent>
      </Card>

      {/* Text Model Management */}
      <TextModelManager />

      {/* FFmpeg */}
      <FfmpegManager />

      <ErrorDisplay
        error={whisper.error()}
        onDismiss={() => whisper.clearError()}
      />
    </div>
  );
}
