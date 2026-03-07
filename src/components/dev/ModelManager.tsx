import { createSignal, For, Show } from "solid-js";
import { useI18n } from "~/i18n";
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
  const { t } = useI18n();
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );

  const downloadedModels = () =>
    props.whisper.models().filter((m) => m.downloaded);

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await props.whisper.deleteModel(modelId);
    setDeletingModelId(null);
    toast.success(t("dev.modelDeletedToast"));
  }

  return (
    <div class="space-y-3">
      <Show
        when={downloadedModels().length > 0}
        fallback={
          <p class="text-sm text-muted-foreground">
            {t("dev.noDownloadedModels")}
          </p>
        }
      >
        <For each={downloadedModels()}>
          {(model) => (
            <div class="flex items-center justify-between rounded-lg border p-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{model.name}</span>
                <Badge variant="secondary">{model.size}</Badge>
                <Show when={model.recommended}>
                  <Badge>{t("common.recommended")}</Badge>
                </Show>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  as={Button}
                  variant="destructive"
                  size="sm"
                  class="min-w-[8rem]"
                  disabled={deletingModelId() === model.id}
                >
                  {deletingModelId() === model.id
                    ? t("common.deleting")
                    : t("common.delete")}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>{t("dev.deleteModel")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("dev.deleteModelConfirmation", {
                      name: model.name,
                      size: model.size,
                    })}
                  </AlertDialogDescription>
                  <div class="flex justify-end gap-2">
                    <AlertDialogTrigger as={Button} variant="outline">
                      {t("common.cancel")}
                    </AlertDialogTrigger>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
