import { save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { FiDisc, FiDownload, FiMic, FiSquare, FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createMemo, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";
import { useI18n } from "~/i18n";
import { formatDurationColon } from "~/lib/format";
import { toast } from "~/lib/toast";
import type { AudioDevice, RecordingLevel } from "~/types";
import { AudioLevelMeter } from "./AudioLevelMeter";

interface RecordingPanelProps {
  devices: AudioDevice[];
  selectedDevice: AudioDevice | null;
  isRecording: boolean;
  level: RecordingLevel | null;
  duration: number;
  tempFilePath: string | null;
  disabled?: boolean;
  onSelectDevice: (device: AudioDevice) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDiscard: () => void;
}

const RecordingPanel: Component<RecordingPanelProps> = (props) => {
  const { t } = useI18n();

  const hasRecording = createMemo(() => props.tempFilePath !== null);

  async function handleSaveWav() {
    if (!props.tempFilePath) return;
    const savePath = await save({
      title: t("dialog.saveWavTitle"),
      defaultPath: "recording.wav",
      filters: [{ name: t("dialog.wavFilter"), extensions: ["wav"] }],
    });
    if (savePath) {
      try {
        await copyFile(props.tempFilePath, savePath);
        toast.success(t("result.savedToast"));
      } catch {
        toast.error(t("result.saveFailedToast"));
      }
    }
  }

  return (
    <div class="flex h-full flex-col gap-3">
      {/* No devices warning - only in idle state */}
      <Show
        when={
          props.devices.length === 0 && !props.isRecording && !hasRecording()
        }
      >
        <p class="py-6 text-center text-sm text-muted-foreground">
          {t("recording.noDevices")}
        </p>
      </Show>

      {/* Device selector - invisible during recording/post-recording to preserve layout */}
      <Show when={props.devices.length > 0}>
        <div
          class={props.isRecording || hasRecording() ? "invisible" : undefined}
        >
          <div class="grid grid-cols-2 items-center gap-4">
            <span class="text-right text-sm font-medium leading-none text-muted-foreground">
              {t("recording.selectDevice")}
            </span>
            <Select<AudioDevice>
              multiple={false}
              options={props.devices}
              optionValue="id"
              optionTextValue="name"
              value={props.selectedDevice}
              onChange={(value) => {
                if (value) props.onSelectDevice(value);
              }}
              disabled={props.isRecording || props.disabled || false}
              disallowEmptySelection
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>
                  {itemProps.item.rawValue.name}
                  <Show when={itemProps.item.rawValue.isDefault}>
                    <span class="ml-1 text-xs text-muted-foreground">
                      ({t("recording.defaultDevice")})
                    </span>
                  </Show>
                </SelectItem>
              )}
            >
              <SelectTrigger>
                <SelectValue<AudioDevice>>
                  {(state) =>
                    state.selectedOption()?.name ?? t("recording.selectDevice")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </div>
      </Show>

      {/* Recording controls - idle or recording */}
      <Show when={!hasRecording()}>
        <div class="relative flex flex-1 flex-col items-center justify-center">
          <Show when={props.isRecording}>
            <div class="absolute inset-x-0 top-0">
              <AudioLevelMeter
                level={props.level?.level ?? 0}
                peakLevel={props.level?.peakLevel ?? 0}
                class="w-full"
              />
            </div>
          </Show>

          {/* Central mic button */}
          <Show
            when={props.isRecording}
            fallback={
              <button
                type="button"
                class="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                disabled={props.disabled || props.devices.length === 0}
                onClick={props.onStartRecording}
                aria-label={t("recording.startRecording")}
              >
                <FiMic class="size-6" />
              </button>
            }
          >
            <button
              type="button"
              class="flex size-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-all hover:scale-105 hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={props.onStopRecording}
              aria-label={t("recording.stopRecording")}
            >
              <FiSquare class="size-6" />
            </button>
          </Show>

          {/* Status label - below the button */}
          <Show
            when={props.isRecording}
            fallback={
              <p class="mt-3 text-sm text-muted-foreground">
                {t("recording.startRecording")}
              </p>
            }
          >
            <div
              role="status"
              aria-live="polite"
              class="mt-3 flex items-center gap-2 text-sm"
            >
              <FiDisc
                class="size-4 animate-pulse text-red-500"
                aria-hidden="true"
              />
              <span class="text-muted-foreground">
                {t("recording.recording")}
              </span>
              <span class="font-mono tabular-nums" aria-hidden="true">
                {formatDurationColon(props.duration)}
              </span>
            </div>
          </Show>
        </div>
      </Show>

      {/* Post-recording summary */}
      <Show when={hasRecording()}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <div class="flex items-center gap-4 rounded-xl border bg-muted/30 px-6 py-4">
            <FiMic class="size-6 text-muted-foreground" />
            <span class="text-base text-muted-foreground">
              {t("recording.title")}
            </span>
            <span class="font-mono text-xl font-medium tabular-nums">
              {formatDurationColon(props.duration)}
            </span>
          </div>
          <div class="flex gap-3">
            <Button variant="ghost" size="sm" onClick={handleSaveWav}>
              <FiDownload class="size-4" />
              {t("recording.saveAsWav")}
            </Button>
            <Button variant="ghost" size="sm" onClick={props.onDiscard}>
              <FiTrash2 class="size-4" />
              {t("recording.discardRecording")}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export { RecordingPanel };
