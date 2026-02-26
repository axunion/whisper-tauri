import { createSignal, Show } from "solid-js";
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
  const [historyOpen, setHistoryOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [ffmpegOpen, setFfmpegOpen] = createSignal(false);

  return (
    <div class="space-y-3">
      {/* Clear History */}
      <div class="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p class="text-sm font-medium">Clear History</p>
          <p class="text-xs text-muted-foreground">
            Delete all transcription history entries
          </p>
        </div>
        <AlertDialog open={historyOpen()} onOpenChange={setHistoryOpen}>
          <AlertDialogTrigger as={Button} variant="destructive" size="sm">
            Clear History
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Clear History</AlertDialogTitle>
            <AlertDialogDescription>
              All transcription history will be permanently deleted. This action
              cannot be undone.
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <AlertDialogTrigger as={Button} variant="outline">
                Cancel
              </AlertDialogTrigger>
              <Button
                variant="destructive"
                onClick={async () => {
                  await props.history.deleteAllEntries();
                  setHistoryOpen(false);
                  toast.success("履歴をクリアしました");
                }}
              >
                Delete All
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Reset Settings */}
      <div class="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p class="text-sm font-medium">Reset Settings</p>
          <p class="text-xs text-muted-foreground">
            Restore all settings to defaults
          </p>
        </div>
        <AlertDialog open={settingsOpen()} onOpenChange={setSettingsOpen}>
          <AlertDialogTrigger as={Button} variant="destructive" size="sm">
            Reset Settings
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Reset Settings</AlertDialogTitle>
            <AlertDialogDescription>
              All settings will be restored to their default values. This action
              cannot be undone.
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <AlertDialogTrigger as={Button} variant="outline">
                Cancel
              </AlertDialogTrigger>
              <Button
                variant="destructive"
                onClick={async () => {
                  await props.settings.reset();
                  setSettingsOpen(false);
                  toast.success("設定をリセットしました");
                }}
              >
                Reset
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Delete FFmpeg */}
      <Show when={props.ffmpeg.isBundled()}>
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p class="text-sm font-medium">Delete FFmpeg</p>
            <p class="text-xs text-muted-foreground">
              Remove bundled FFmpeg binary
            </p>
          </div>
          <AlertDialog open={ffmpegOpen()} onOpenChange={setFfmpegOpen}>
            <AlertDialogTrigger as={Button} variant="destructive" size="sm">
              Delete FFmpeg
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Delete FFmpeg</AlertDialogTitle>
              <AlertDialogDescription>
                The bundled FFmpeg binary will be deleted. You can download it
                again from Settings.
              </AlertDialogDescription>
              <div class="flex justify-end gap-2">
                <AlertDialogTrigger as={Button} variant="outline">
                  Cancel
                </AlertDialogTrigger>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await props.ffmpeg.deleteBundled();
                    setFfmpegOpen(false);
                    toast.success("FFmpegを削除しました");
                  }}
                >
                  Delete
                </Button>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Show>
    </div>
  );
}
