import { FiDownload, FiMusic, FiTrash2 } from "solid-icons/fi";
import { createSignal, For, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { ModelListItem } from "~/components/ui/ModelListItem";
import { useI18n } from "~/i18n";
import { getModelDescription } from "~/lib/modelDescription";
import { toast } from "~/lib/toast";
import { createWhisper } from "~/primitives/createWhisper";

export default function WhisperModelManager() {
  const { t } = useI18n();
  const whisper = createWhisper();
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );

  onMount(() => {
    whisper.loadModels();
  });

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await whisper.deleteModel(modelId);
    setDeletingModelId(null);
    toast.success(t("settings.modelDeletedToast"));
  }

  const isSelected = (modelId: string) =>
    whisper.selectedModel()?.id === modelId;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiMusic class="size-4" />}>
            {t("settings.modelManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent class="space-y-4" role="radiogroup">
          <For each={whisper.models()}>
            {(model) => (
              <ModelListItem
                name={model.name}
                size={model.size}
                description={getModelDescription(
                  t,
                  model.id,
                  model.description,
                )}
                downloaded={model.downloaded}
                selected={isSelected(model.id)}
                onSelect={() => whisper.selectModel(model)}
                actionSlot={
                  <Show
                    when={model.downloaded}
                    fallback={
                      <Show
                        when={
                          whisper.isDownloading() &&
                          whisper.downloadProgress()?.modelId === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={() => whisper.downloadModel(model.id)}
                            disabled={whisper.isDownloading()}
                          >
                            <FiDownload />
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <DownloadProgress
                          progress={whisper.downloadProgress()?.progress ?? 0}
                        />
                      </Show>
                    }
                  >
                    <ConfirmDialog
                      title={t("settings.deleteModel")}
                      description={t("settings.deleteModelConfirmation", {
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
          <Show when={whisper.models().length === 0}>
            <p class="text-sm text-muted-foreground">
              {t("settings.loadingModels")}
            </p>
          </Show>
        </CardContent>
      </Card>

      <ErrorDisplay
        error={whisper.error()}
        onDismiss={() => whisper.clearError()}
      />
    </>
  );
}
