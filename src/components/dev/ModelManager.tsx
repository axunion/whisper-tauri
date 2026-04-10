import { FiDownload, FiTrash2 } from "solid-icons/fi";
import { createSignal, For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { ModelListItem } from "~/components/ui/ModelListItem";
import { useI18n } from "~/i18n";
import { getModelDescription } from "~/lib/modelDescription";
import { toast } from "~/lib/toast";
import type { createWhisper } from "~/primitives/createWhisper";

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
    <div class="space-y-4" role="radiogroup">
      <For each={props.whisper.models()}>
        {(model) => (
          <ModelListItem
            name={model.name}
            size={model.size}
            description={getModelDescription(t, model.id, model.description)}
            downloaded={model.downloaded}
            selected={isSelected(model.id)}
            onSelect={() => props.whisper.selectModel(model)}
            actionSlot={
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
                        onClick={() => props.whisper.downloadModel(model.id)}
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
                <ConfirmDialog
                  title={t("dev.deleteModel")}
                  description={t("dev.deleteModelConfirmation", {
                    name: model.name,
                  })}
                  confirmLabel={
                    <>
                      <FiTrash2 />
                      {t("common.delete")}
                    </>
                  }
                  onConfirm={() => handleDeleteModel(model.id)}
                >
                  {(openDialog) => (
                    <Button
                      variant="destructive"
                      size="sm"
                      class="w-28"
                      disabled={deletingModelId() === model.id}
                      onClick={openDialog}
                    >
                      <FiTrash2 />
                      {deletingModelId() === model.id
                        ? t("common.deleting")
                        : t("common.delete")}
                    </Button>
                  )}
                </ConfirmDialog>
              </Show>
            }
          />
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
