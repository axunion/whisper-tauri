import { FiDownload, FiMusic, FiTrash2, FiX } from "solid-icons/fi";
import { createSignal, For, onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/AlertDialog";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
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
        <CardContent class="space-y-4">
          <For each={whisper.models()}>
            {(model) => (
              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                  model.downloaded
                    ? isSelected(model.id)
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/50"
                    : ""
                }`}
                onClick={() => {
                  if (model.downloaded) whisper.selectModel(model);
                }}
                disabled={!model.downloaded}
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
                          whisper.isDownloading() &&
                          whisper.downloadProgress()?.modelId === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              whisper.downloadModel(model.id);
                            }}
                            disabled={whisper.isDownloading()}
                          >
                            <FiDownload />
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <div class="w-28 space-y-1">
                          <Progress
                            value={whisper.downloadProgress()?.progress ?? 0}
                            minValue={0}
                            maxValue={100}
                          />
                          <p class="text-center text-xs text-muted-foreground">
                            {Math.round(
                              whisper.downloadProgress()?.progress ?? 0,
                            )}
                            %
                          </p>
                        </div>
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
                        <AlertDialogTitle>
                          {t("settings.deleteModel")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("settings.deleteModelConfirmation", {
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
