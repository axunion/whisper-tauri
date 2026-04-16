import { FiSettings } from "solid-icons/fi";
import { onMount } from "solid-js";
import {
  FfmpegManager,
  SettingsSelect,
  WhisperModelManager,
} from "~/components/settings";
import { TextModelManager } from "~/components/text-processing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { Checkbox } from "~/components/ui/Checkbox";
import { Separator } from "~/components/ui/Separator";
import { useI18n } from "~/i18n";
import { createSettings } from "~/primitives/createSettings";
import { applyTheme } from "~/primitives/createTheme";
import type { AppSettings } from "~/types";

type OptionItem = { value: string; label: string };

export default function Settings() {
  const { t, setLocale } = useI18n();
  const settings = createSettings();

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

      {/* Model Management */}
      <WhisperModelManager />

      {/* Text Model Management */}
      <TextModelManager />

      {/* FFmpeg */}
      <FfmpegManager />
    </div>
  );
}
