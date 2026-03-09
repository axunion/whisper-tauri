import { createSignal, For, onMount, Show } from "solid-js";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import { createTextProcessing } from "~/primitives/createTextProcessing";

export default function TextModelManager() {
  const { t } = useI18n();
  const tp = createTextProcessing();
  const [deletingModelId, setDeletingModelId] = createSignal<string | null>(
    null,
  );

  onMount(() => {
    tp.loadModels();
    tp.checkServer();
  });

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await tp.deleteModel(modelId);
    setDeletingModelId(null);
    toast.success(t("textProcessing.modelDeletedToast"));
  }

  async function handleDownloadModel(modelId: string) {
    await tp.downloadModel(modelId);
    toast.success(t("textProcessing.modelDownloadedToast"));
  }

  async function handleDownloadServer() {
    await tp.downloadServer();
    toast.success(t("textProcessing.serverDownloadedToast"));
  }

  return (
    <>
      {/* Text Model Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t("textProcessing.modelManagement")}</CardTitle>
          <CardDescription>
            {t("textProcessing.modelManagementDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <For each={tp.models()}>
            {(model) => (
              <div class="flex items-center justify-between rounded-lg border p-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{model.name}</span>
                    <Badge variant="secondary">{model.size}</Badge>
                  </div>
                  <p class="text-sm text-muted-foreground">
                    {model.description}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <Show
                    when={model.downloaded}
                    fallback={
                      <Show
                        when={
                          tp.isDownloading() &&
                          tp.downloadProgress()?.modelId === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={() => handleDownloadModel(model.id)}
                            disabled={tp.isDownloading()}
                          >
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <div class="w-28 space-y-1">
                          <Progress
                            value={tp.downloadProgress()?.progress ?? 0}
                            minValue={0}
                            maxValue={100}
                          />
                          <p class="text-center text-xs text-muted-foreground">
                            {Math.round(tp.downloadProgress()?.progress ?? 0)}%
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
                      >
                        {deletingModelId() === model.id
                          ? t("common.deleting")
                          : t("common.delete")}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>
                          {t("textProcessing.deleteModel")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("textProcessing.deleteModelConfirmation", {
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
                  </Show>
                </div>
              </div>
            )}
          </For>
        </CardContent>
      </Card>

      {/* Server Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t("textProcessing.serverManagement")}</CardTitle>
          <CardDescription>
            {t("textProcessing.serverManagementDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="flex items-center gap-2">
              <span class="font-medium">llama-server</span>
              <Show when={tp.serverAvailable()}>
                <Badge variant="secondary">{t("dashboard.downloaded")}</Badge>
              </Show>
            </div>
            <Show
              when={tp.serverAvailable()}
              fallback={
                <Show
                  when={
                    tp.isDownloading() &&
                    tp.downloadProgress()?.modelId === "llama-server"
                  }
                  fallback={
                    <Button
                      variant="outline"
                      size="sm"
                      class="w-28"
                      onClick={handleDownloadServer}
                      disabled={tp.isDownloading()}
                    >
                      {t("common.download")}
                    </Button>
                  }
                >
                  <div class="w-28 space-y-1">
                    <Progress
                      value={tp.downloadProgress()?.progress ?? 0}
                      minValue={0}
                      maxValue={100}
                    />
                    <p class="text-center text-xs text-muted-foreground">
                      {Math.round(tp.downloadProgress()?.progress ?? 0)}%
                    </p>
                  </div>
                </Show>
              }
            >
              <Badge variant="outline">{t("dashboard.downloaded")}</Badge>
            </Show>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
