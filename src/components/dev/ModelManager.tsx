import { createSignal, For, Show } from "solid-js";
import { toast } from "~/lib/toast";
import type { createWhisper } from "~/primitives/createWhisper";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/AlertDialog";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface ModelManagerProps {
  whisper: ReturnType<typeof createWhisper>;
}

export function ModelManager(props: ModelManagerProps) {
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );
  const [isDeletingAll, setIsDeletingAll] = createSignal(false);
  const [deleteAllOpen, setDeleteAllOpen] = createSignal(false);

  const downloadedModels = () =>
    props.whisper.models().filter((m) => m.downloaded);

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await props.whisper.deleteModel(modelId);
    setDeletingModelId(null);
    toast.success("モデルを削除しました");
  }

  async function handleDeleteAll() {
    setIsDeletingAll(true);
    const models = downloadedModels();
    for (const model of models) {
      await props.whisper.deleteModel(model.id);
    }
    setIsDeletingAll(false);
    setDeleteAllOpen(false);
    toast.success("全モデルを削除しました");
  }

  return (
    <div class="space-y-3">
      <Show
        when={downloadedModels().length > 0}
        fallback={
          <p class="text-sm text-muted-foreground">No downloaded models.</p>
        }
      >
        <For each={downloadedModels()}>
          {(model) => (
            <div class="flex items-center justify-between rounded-lg border p-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{model.name}</span>
                <Badge variant="secondary">{model.size}</Badge>
                <Show when={model.recommended}>
                  <Badge>Recommended</Badge>
                </Show>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  as={Button}
                  variant="destructive"
                  size="sm"
                  disabled={deletingModelId() === model.id}
                >
                  {deletingModelId() === model.id ? "Deleting..." : "Delete"}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Delete Model</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`Delete ${model.name} (${model.size})? This action cannot be undone.`}
                  </AlertDialogDescription>
                  <div class="flex justify-end gap-2">
                    <AlertDialogTrigger as={Button} variant="outline">
                      Cancel
                    </AlertDialogTrigger>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </For>

        <AlertDialog open={deleteAllOpen()} onOpenChange={setDeleteAllOpen}>
          <AlertDialogTrigger
            as={Button}
            variant="destructive"
            size="sm"
            class="w-full"
            disabled={isDeletingAll()}
          >
            {isDeletingAll() ? "Deleting All..." : "Delete All Models"}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Delete All Models</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete all ${downloadedModels().length} downloaded models? This action cannot be undone.`}
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <AlertDialogTrigger as={Button} variant="outline">
                Cancel
              </AlertDialogTrigger>
              <Button variant="destructive" onClick={handleDeleteAll}>
                Delete All
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </Show>
    </div>
  );
}
