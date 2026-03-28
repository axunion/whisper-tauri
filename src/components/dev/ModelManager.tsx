import { FiDownload, FiTrash2, FiX } from "solid-icons/fi";
import { createSignal, For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import { getModelDescription } from "~/lib/modelDescription";
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
import { DownloadProgress } from "../ui/DownloadProgress";

interface ModelManagerProps {
  whisper: ReturnType<typeof createWhisper>;
}

export function ModelManager(props: ModelManagerProps) {
  const { t } = useI18n();
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );

  const isSelected = (modelId: string) =>
    props.whisper.selectedModel()?.id === modelId;

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    try {
      await props.whisper.deleteModel(modelId);
      toast.success(t("dev.modelDeletedToast"));
    } finally {
      setDeletingModelId(null);
    }
  }

  return (
    <div class="space-y-4">
      <For each={props.whisper.models()}>
        {(model) => (
          <button
            type="button"
            class={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
              model.downloaded
                ? isSelected(model.id)
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:bg-muted/50"
                : "opacity-50 pointer-events-auto"
            }`}
            aria-disabled={!model.downloaded}
            onClick={() => {
              if (model.downloaded) props.whisper.selectModel(model);
            }}
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">{model.name}</span>
                <Badge variant="secondary">{model.size}</Badge>
              </div>
              <p class="text-sm text-muted-foreground">
                {getModelDescription(t, model.id, model.description)}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Show
                when={model.downloaded}
                fallback={
                  <Show
                    when={
                      props.whisper.isDownloading() &&
                      props.whisper.downloadProgress()?.modelId === model.id
                    }
                    fallback={
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-28"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          props.whisper.downloadModel(model.id);
                        }}
                        disabled={props.whisper.isDownloading()}
                      >
                        <FiDownload />
                        {t("common.download")}
                      </Button>
                    }
                  >
                    <DownloadProgress
                      progress={props.whisper.downloadProgress()?.progress ?? 0}
                    />
                  </Show>
                }
              >
                <AlertDialog>
                  <AlertDialogTrigger
                    as={Button}
                    variant="destructive"
                    size="sm"
                    class="w-28"
                    disabled={deletingModelId() === model.id}
                    onClick={(e: MouseEvent) => e.stopPropagation()}
                  >
                    <FiTrash2 />
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
                      <AlertDialogTrigger
                        as={Button}
                        variant="outline"
                        class="w-32"
                      >
                        <FiX />
                        {t("common.cancel")}
                      </AlertDialogTrigger>
                      <Button
                        variant="destructive"
                        class="w-32"
                        onClick={() => handleDeleteModel(model.id)}
                      >
                        <FiTrash2 />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </Show>
            </div>
          </button>
        )}
      </For>
      <Show when={props.whisper.models().length === 0}>
        <p class="text-sm text-muted-foreground">
          {t("dev.noDownloadedModels")}
        </p>
      </Show>
    </div>
  );
}
