import { open } from "@tauri-apps/plugin-dialog";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiPlus,
  FiRefreshCw,
  FiUpload,
  FiXCircle,
} from "solid-icons/fi";
import type { Component } from "solid-js";
import { Show } from "solid-js";

import { useI18n } from "~/i18n";
import { AUDIO_EXTENSIONS, extractFilename } from "~/lib/constants";
import { formatDurationColon } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { FileInfo } from "~/types";

interface FileSelectorProps {
  file: FileInfo | null;
  estimateLabel?: string | undefined;
  onFileSelect: (file: FileInfo) => void;
  onFilesAdd: (paths: string[]) => void;
  onFileClear: () => void;
  disabled?: boolean;
  /** True while files are being dragged over the window. */
  dragging?: boolean;
}

const FileSelector: Component<FileSelectorProps> = (props) => {
  const { t } = useI18n();

  function pick<T extends boolean>(multiple: T) {
    return open({
      multiple,
      title: t("dialog.openAudioTitle"),
      filters: [
        {
          name: t("dialog.audioFilter"),
          extensions: AUDIO_EXTENSIONS,
        },
      ],
    });
  }

  /** Replaces the selected file. */
  async function handleChange() {
    if (props.disabled) return;
    const path = await pick(false);
    if (path) {
      props.onFileSelect({ path, name: extractFilename(path), size: 0 });
    }
  }

  /** Adds any number of files; they queue up behind the selected one. */
  async function handleAdd() {
    if (props.disabled) return;
    const paths = await pick(true);
    if (paths && paths.length > 0) props.onFilesAdd(paths);
  }

  return (
    <Show
      when={props.file}
      fallback={
        <button
          type="button"
          class={cn(
            "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
            props.dragging && "border-primary/60 bg-primary/5 text-foreground",
          )}
          disabled={props.disabled}
          onClick={handleAdd}
        >
          <FiUpload class="size-7" />
          <span class="text-sm font-medium">
            {t("transcription.selectAudioFile")}
          </span>
          <span class="text-sm text-muted-foreground">
            {t("transcription.supportedFormats")}
          </span>
        </button>
      }
    >
      {(file) => (
        <div class="flex h-full flex-col items-center justify-center gap-3">
          <div class="flex items-start gap-4 px-6">
            <FiCheckCircle class="mt-0.5 size-6 shrink-0 text-primary" />
            <span class="min-w-0 break-all text-center text-lg font-medium">
              {file().name}
            </span>
            <button
              type="button"
              class="mt-0.5 shrink-0 text-muted-foreground/40 transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              aria-label={t("transcription.clearFile")}
              disabled={props.disabled}
              onClick={() => props.onFileClear()}
            >
              <FiXCircle class="size-5" aria-hidden="true" />
            </button>
          </div>
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={props.disabled}
              onClick={handleChange}
            >
              <FiRefreshCw class="size-3.5" />
              {t("transcription.changeFile")}
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={props.disabled}
              onClick={handleAdd}
            >
              <FiPlus class="size-3.5" />
              {t("transcription.addFiles")}
            </button>
          </div>
          <Show when={file().duration}>
            {(dur) => (
              <div class="mt-3 flex items-center gap-3">
                <span class="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-sm text-muted-foreground">
                  <FiClock class="size-3.5" />
                  {formatDurationColon(dur())}
                </span>
                <Show when={props.estimateLabel}>
                  {(label) => (
                    <span class="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-sm text-muted-foreground">
                      <FiActivity class="size-3.5" />
                      {label()}
                    </span>
                  )}
                </Show>
              </div>
            )}
          </Show>
        </div>
      )}
    </Show>
  );
};

export { FileSelector };
