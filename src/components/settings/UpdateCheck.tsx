import { openUrl } from "@tauri-apps/plugin-opener";
import { FiExternalLink } from "solid-icons/fi";
import { Match, Switch } from "solid-js";
import { Button } from "~/components/ui/Button";
import { SectionRow } from "~/components/ui/SectionRow";
import { useI18n } from "~/i18n";
import { createUpdateCheck } from "~/primitives/createUpdateCheck";

const RELEASES_URL = "https://github.com/axunion/whisper-tauri/releases/latest";

export default function UpdateCheck() {
  const { t } = useI18n();
  const updateCheck = createUpdateCheck();

  const available = () => {
    const status = updateCheck.status();
    return status.state === "available" ? status : null;
  };

  return (
    <div class="space-y-2">
      <SectionRow
        title={t("settings.appUpdate")}
        description={t("settings.appUpdateCurrentVersion", {
          version: updateCheck.currentVersion() || "—",
        })}
        right={
          <Button
            variant="outline"
            size="sm"
            class="w-28"
            disabled={updateCheck.status().state === "checking"}
            onClick={() => void updateCheck.check()}
          >
            {t("settings.appUpdateCheck")}
          </Button>
        }
      />
      <Switch>
        <Match when={updateCheck.status().state === "checking"}>
          <p class="text-sm text-muted-foreground">
            {t("settings.appUpdateChecking")}
          </p>
        </Match>
        <Match when={updateCheck.status().state === "latest"}>
          <p class="text-sm text-muted-foreground">
            {t("settings.appUpdateLatest")}
          </p>
        </Match>
        <Match when={available()}>
          {(status) => (
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm">
                {t("settings.appUpdateAvailable", {
                  version: status().version,
                })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openUrl(RELEASES_URL)}
              >
                <FiExternalLink />
                {t("settings.appUpdateOpenReleases")}
              </Button>
            </div>
          )}
        </Match>
        <Match when={updateCheck.status().state === "error"}>
          <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t("settings.appUpdateCheckFailed")}
          </div>
        </Match>
      </Switch>
    </div>
  );
}
