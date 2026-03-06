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
  onTranscribe: () => void;
  onDiscard: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const RecordingPanel: Component<RecordingPanelProps> = (props) => {
  const { t } = useI18n();

  const hasRecording = createMemo(() => props.tempFilePath !== null);

  async function handleSaveWav() {
    if (!props.tempFilePath) return;
    const savePath = await save({
      defaultPath: "recording.wav",
      filters: [{ name: "WAV", extensions: ["wav"] }],
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
    <div class="space-y-8">
      {/* Device selector */}
      <Show
        when={props.devices.length > 0}
        fallback={
          <p class="py-6 text-center text-sm text-muted-foreground">
            {t("recording.noDevices")}
          </p>
        }
      >
        <div>
          <span class="mb-2.5 block text-sm font-medium leading-none">
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
      </Show>

      {/* Recording controls - idle or recording */}
      <Show when={!hasRecording()}>
        <div class="flex flex-col items-center gap-6 py-8">
          <Show when={props.isRecording}>
            <AudioLevelMeter
              level={props.level?.level ?? 0}
              peakLevel={props.level?.peakLevel ?? 0}
              class="w-full"
            />
          </Show>

          {/* Central mic button */}
          <Show
            when={props.isRecording}
            fallback={
              <button
                type="button"
                class="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                disabled={props.disabled || props.devices.length === 0}
                onClick={props.onStartRecording}
              >
                <FiMic class="size-7" />
              </button>
            }
          >
            <button
              type="button"
              class="flex size-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-all hover:scale-105 hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={props.onStopRecording}
            >
              <FiSquare class="size-7" />
            </button>
          </Show>

          {/* Status label */}
          <Show
            when={props.isRecording}
            fallback={
              <p class="text-sm text-muted-foreground">
                {t("recording.startRecording")}
              </p>
            }
          >
            <div class="flex items-center gap-2 text-sm">
              <FiDisc class="size-4 animate-pulse text-red-500" />
              <span class="text-muted-foreground">
                {t("recording.recording")}
              </span>
              <span class="font-mono tabular-nums">
                {formatDuration(props.duration)}
              </span>
            </div>
          </Show>
        </div>
      </Show>

      {/* Post-recording actions */}
      <Show when={hasRecording()}>
        <div class="space-y-6">
          {/* Recording summary */}
          <div class="flex items-center justify-center gap-3 rounded-lg border bg-muted/30 px-5 py-4">
            <FiMic class="size-5 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">
              {t("recording.title")}
            </span>
            <span class="font-mono text-sm tabular-nums">
              {formatDuration(props.duration)}
            </span>
          </div>

          {/* Actions: primary transcribe + secondary row */}
          <div class="flex flex-col items-center gap-4">
            <Button
              size="lg"
              class="px-10"
              onClick={props.onTranscribe}
              disabled={props.disabled}
            >
              {t("recording.transcribeRecording")}
            </Button>
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
        </div>
      </Show>
    </div>
  );
};

export { RecordingPanel };
