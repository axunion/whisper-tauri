import { FiRotateCcw, FiTrash2, FiX } from "solid-icons/fi";
import { createSignal, Show } from "solid-js";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import type { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import type { createHistory } from "~/primitives/createHistory";
import type { createSettings } from "~/primitives/createSettings";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/AlertDialog";
import { Button } from "../ui/Button";

interface CacheClearProps {
  history: ReturnType<typeof createHistory>;
  settings: ReturnType<typeof createSettings>;
  ffmpeg: ReturnType<typeof createFfmpegDownloader>;
}

export function CacheClear(props: CacheClearProps) {
  const { t } = useI18n();
  const [historyOpen, setHistoryOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [ffmpegOpen, setFfmpegOpen] = createSignal(false);

  return (
    <div class="space-y-3">
      {/* Clear History */}
      <div class="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p class="text-sm font-medium">{t("dev.clearHistory")}</p>
          <p class="text-xs text-muted-foreground">
            {t("dev.clearHistoryDescription")}
          </p>
        </div>
        <AlertDialog open={historyOpen()} onOpenChange={setHistoryOpen}>
          <AlertDialogTrigger
            as={Button}
            variant="destructive"
            size="sm"
            class="min-w-[8rem]"
          >
            <FiTrash2 />
            {t("dev.clearHistory")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{t("dev.clearHistory")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dev.clearHistoryConfirmation")}
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <AlertDialogTrigger as={Button} variant="outline" class="w-32">
                <FiX />
                {t("common.cancel")}
              </AlertDialogTrigger>
              <Button
                variant="destructive"
                class="w-32"
                onClick={async () => {
                  await props.history.deleteAllEntries();
                  setHistoryOpen(false);
                  toast.success(t("dev.historyClearedToast"));
                }}
              >
                <FiTrash2 />
                {t("dev.deleteAll")}
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Reset Settings */}
      <div class="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p class="text-sm font-medium">{t("dev.resetSettings")}</p>
          <p class="text-xs text-muted-foreground">
            {t("dev.resetSettingsDescription")}
          </p>
        </div>
        <AlertDialog open={settingsOpen()} onOpenChange={setSettingsOpen}>
          <AlertDialogTrigger
            as={Button}
            variant="destructive"
            size="sm"
            class="min-w-[8rem]"
          >
            <FiRotateCcw />
            {t("dev.resetSettings")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{t("dev.resetSettings")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dev.resetSettingsConfirmation")}
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <AlertDialogTrigger as={Button} variant="outline" class="w-32">
                <FiX />
                {t("common.cancel")}
              </AlertDialogTrigger>
              <Button
                variant="destructive"
                class="w-32"
                onClick={async () => {
                  await props.settings.reset();
                  setSettingsOpen(false);
                  toast.success(t("dev.settingsResetToast"));
                }}
              >
                <FiRotateCcw />
                {t("common.reset")}
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Delete FFmpeg */}
      <Show when={props.ffmpeg.isBundled()}>
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p class="text-sm font-medium">{t("dev.deleteFfmpeg")}</p>
            <p class="text-xs text-muted-foreground">
              {t("dev.deleteFfmpegDescription")}
            </p>
          </div>
          <AlertDialog open={ffmpegOpen()} onOpenChange={setFfmpegOpen}>
            <AlertDialogTrigger
              as={Button}
              variant="destructive"
              size="sm"
              class="min-w-[8rem]"
            >
              <FiTrash2 />
              {t("dev.deleteFfmpeg")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>{t("dev.deleteFfmpeg")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("dev.deleteFfmpegConfirmation")}
              </AlertDialogDescription>
              <div class="flex justify-end gap-2">
                <AlertDialogTrigger as={Button} variant="outline" class="w-32">
                  <FiX />
                  {t("common.cancel")}
                </AlertDialogTrigger>
                <Button
                  variant="destructive"
                  class="w-32"
                  onClick={async () => {
                    await props.ffmpeg.deleteBundled();
                    setFfmpegOpen(false);
                    toast.success(t("dev.ffmpegDeletedToast"));
                  }}
                >
                  <FiTrash2 />
                  {t("common.delete")}
                </Button>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Show>
    </div>
  );
}
