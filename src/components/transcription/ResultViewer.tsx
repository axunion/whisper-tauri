import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { FiCheck, FiCopy } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import type { TranscriptionResult } from "~/types";

interface ResultViewerProps {
  result: TranscriptionResult;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

const ResultViewer: Component<ResultViewerProps> = (props) => {
  const [copied, setCopied] = createSignal(false);

  async function handleCopy() {
    await writeText(props.result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Badge variant="secondary">{props.result.language}</Badge>
          <span class="text-xs text-muted-foreground">
            {formatDuration(props.result.duration)}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          <Show when={copied()} fallback={<FiCopy class="size-4" />}>
            <FiCheck class="size-4" />
          </Show>
          <Show when={copied()} fallback="Copy">
            Copied
          </Show>
        </Button>
      </div>
      <div class="max-h-80 overflow-y-auto rounded-lg border bg-muted/50 p-4">
        <p class="whitespace-pre-wrap text-sm">{props.result.text}</p>
      </div>
    </div>
  );
};

export { ResultViewer };
