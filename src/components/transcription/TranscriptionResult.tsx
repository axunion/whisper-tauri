import { FiCheck, FiX } from "solid-icons/fi";
import { createSignal, Show } from "solid-js";
import type { TranscriptionResult as TranscriptionResultType } from "~/types";
import { ResultViewer } from "./ResultViewer";

interface TranscriptionResultProps {
  result: TranscriptionResultType;
  fileName: string;
  historyId: string | null;
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
}

export function TranscriptionResult(props: TranscriptionResultProps) {
  const [titleEditing, setTitleEditing] = createSignal(false);
  const [titleEditValue, setTitleEditValue] = createSignal("");
  const [isGeneratingTitle, setIsGeneratingTitle] = createSignal(false);

  function handleTitleGenerated(title: string) {
    setTitleEditValue(title);
    setTitleEditing(true);
  }

  function confirmTitle() {
    const trimmed = titleEditValue().trim();
    const id = props.historyId;
    if (trimmed && id) {
      props.onRename(id, trimmed);
    }
    setTitleEditing(false);
  }

  function cancelTitle() {
    setTitleEditing(false);
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitle();
    }
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-2">
      <div class="flex h-8 items-center gap-1.5">
        <div class="min-w-0 flex-1">
          <Show
            when={titleEditing()}
            fallback={
              <span
                class="block truncate text-lg font-semibold"
                classList={{ "animate-pulse": isGeneratingTitle() }}
              >
                {props.fileName}
              </span>
            }
          >
            <input
              type="text"
              autofocus
              class="w-full border-b border-muted-foreground/40 bg-transparent text-lg font-semibold outline-none"
              value={titleEditValue()}
              onInput={(e) => setTitleEditValue(e.currentTarget.value)}
              onKeyDown={handleTitleKeyDown}
            />
          </Show>
        </div>
        <Show when={titleEditing()}>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={confirmTitle}
          >
            <FiCheck class="size-3.5" />
          </button>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={cancelTitle}
          >
            <FiX class="size-3.5" />
          </button>
        </Show>
      </div>
      <ResultViewer
        result={props.result}
        historyId={props.historyId ?? undefined}
        onClose={props.onClose}
        onTitleGenerated={handleTitleGenerated}
        onGeneratingTitleChange={setIsGeneratingTitle}
      />
    </div>
  );
}
