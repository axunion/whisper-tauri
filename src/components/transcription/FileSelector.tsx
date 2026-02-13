import { open } from "@tauri-apps/plugin-dialog";
import { FiFile, FiUpload, FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import type { FileInfo } from "~/types";

interface FileSelectorProps {
  file: FileInfo | null;
  onFileSelect: (file: FileInfo) => void;
  onFileClear: () => void;
  disabled?: boolean;
}

const AUDIO_EXTENSIONS = ["wav", "mp3", "m4a", "flac", "ogg"];

const FileSelector: Component<FileSelectorProps> = (props) => {
  async function handleClick() {
    if (props.disabled) return;

    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Audio Files",
          extensions: AUDIO_EXTENSIONS,
        },
      ],
    });

    if (selected) {
      const path = typeof selected === "string" ? selected : selected.path;
      const name = path.split("/").pop() ?? path.split("\\").pop() ?? path;
      props.onFileSelect({
        path,
        name,
        size: 0,
      });
    }
  }

  return (
    <Show
      when={props.file}
      fallback={
        <button
          type="button"
          class="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={props.disabled}
          onClick={handleClick}
        >
          <FiUpload class="size-8" />
          <span class="text-sm font-medium">Click to select an audio file</span>
          <span class="text-xs">WAV, MP3, M4A, FLAC, OGG</span>
        </button>
      }
    >
      {(file) => (
        <div class="flex items-center gap-3 rounded-lg border bg-card p-4">
          <FiFile class="size-8 shrink-0 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{file().name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => props.onFileClear()}
            disabled={props.disabled}
          >
            <FiX class="size-4" />
          </Button>
        </div>
      )}
    </Show>
  );
};

export { FileSelector };
