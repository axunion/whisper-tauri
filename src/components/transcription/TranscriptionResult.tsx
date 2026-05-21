import { FiCheck, FiX } from "solid-icons/fi";
import { createSignal, Show } from "solid-js";
import type { NotionMetaContext } from "~/lib/notion";
import { createTitleEditor } from "~/primitives/createTitleEditor";
import type { TranscriptionResult as TranscriptionResultType } from "~/types";
import { ResultViewer } from "./ResultViewer";

interface TranscriptionResultProps {
  result: TranscriptionResultType;
  fileName: string;
  historyId: string | null;
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
  notionMeta?: NotionMetaContext | undefined;
}

export function TranscriptionResult(props: TranscriptionResultProps) {
  const [isGeneratingTitle, setIsGeneratingTitle] = createSignal(false);

  const title = createTitleEditor({
    onConfirm: (value) => {
      const id = props.historyId;
      if (id) props.onRename(id, value);
    },
  });

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-2">
      <div class="flex h-8 items-center gap-1.5">
        <div class="min-w-0 flex-1">
          <Show
            when={title.isEditing()}
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
              value={title.editValue()}
              onInput={(e) => title.setEditValue(e.currentTarget.value)}
              onKeyDown={title.handleKeyDown}
            />
          </Show>
        </div>
        <Show when={title.isEditing()}>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={title.confirm}
          >
            <FiCheck class="size-3.5" />
          </button>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={title.cancel}
          >
            <FiX class="size-3.5" />
          </button>
        </Show>
      </div>
      <ResultViewer
        result={props.result}
        fileNameText={props.fileName}
        historyId={props.historyId ?? undefined}
        onClose={props.onClose}
        onTitleGenerated={title.startEditing}
        onGeneratingTitleChange={setIsGeneratingTitle}
        notionMeta={{
          ...(props.notionMeta ?? {}),
          duration: props.result.duration,
        }}
      />
    </div>
  );
}
