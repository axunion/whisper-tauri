import { FiMic, FiMonitor, FiMoon, FiShield, FiSun } from "solid-icons/fi";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/ToggleGroup";
import type { Locale } from "~/i18n";
import { useI18n } from "~/i18n";
import type { createSettings } from "~/primitives/createSettings";
import type { AppSettings } from "~/types/settings";

interface WelcomeStepProps {
  settings: ReturnType<typeof createSettings>;
}

export function WelcomeStep(props: WelcomeStepProps) {
  const { t, setLocale } = useI18n();

  function handleLanguageChange(lang: Locale) {
    props.settings.update({ language: lang });
    setLocale(lang);
  }

  function handleThemeChange(theme: AppSettings["theme"]) {
    props.settings.update({ theme });
  }

  return (
    <div class="animate-fade-in flex flex-col items-center gap-5 text-center">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-scale-in">
        <FiMic class="size-6" />
      </div>

      <div class="space-y-1.5">
        <div class="text-xl font-bold tracking-tight">
          {t("onboarding.welcomeTitle")}
        </div>
        <p class="text-sm text-muted-foreground">
          {t("onboarding.welcomeSubtitle")}
        </p>
      </div>

      <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
        <div class="flex items-center gap-3">
          <FiShield class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p class="text-sm text-emerald-700 dark:text-emerald-300">
            {t("onboarding.privacyMessage")}
          </p>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">
          {t("onboarding.chooseLanguage")}
        </p>
        <ToggleGroup>
          <ToggleGroupItem
            value="ja"
            data-pressed={props.settings.language() === "ja"}
            onClick={() => handleLanguageChange("ja")}
          >
            日本語
          </ToggleGroupItem>
          <ToggleGroupItem
            value="en"
            data-pressed={props.settings.language() === "en"}
            onClick={() => handleLanguageChange("en")}
          >
            English
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">
          {t("onboarding.chooseTheme")}
        </p>
        <ToggleGroup>
          <ToggleGroupItem
            value="light"
            data-pressed={props.settings.theme() === "light"}
            onClick={() => handleThemeChange("light")}
          >
            <FiSun class="size-3.5" />
            {t("settings.themeLight")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            data-pressed={props.settings.theme() === "dark"}
            onClick={() => handleThemeChange("dark")}
          >
            <FiMoon class="size-3.5" />
            {t("settings.themeDark")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="system"
            data-pressed={props.settings.theme() === "system"}
            onClick={() => handleThemeChange("system")}
          >
            <FiMonitor class="size-3.5" />
            {t("settings.themeSystem")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
