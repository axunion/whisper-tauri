import { FiCpu, FiDownload, FiServer, FiTrash2, FiX } from "solid-icons/fi";
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
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { Progress } from "~/components/ui/Progress";
import { useI18n } from "~/i18n";
import { getModelDescription } from "~/lib/modelDescription";
import { toast } from "~/lib/toast";
import { createTextProcessing } from "~/primitives/createTextProcessing";

interface TextModelManagerProps {
  devMode?: boolean;
  textProcessing?: ReturnType<typeof createTextProcessing>;
}

export default function TextModelManager(props: TextModelManagerProps) {
  const { t } = useI18n();
  const tp = props.textProcessing ?? createTextProcessing();
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
    const ok = await tp.downloadModel(modelId);
    if (ok) {
      toast.success(t("textProcessing.modelDownloadedToast"));
    } else {
      const err = tp.error();
      if (err) toast.error(err.message);
    }
  }

  async function handleDownloadServer() {
    const ok = await tp.downloadServer();
    if (ok) {
      toast.success(t("textProcessing.serverDownloadedToast"));
    } else {
      const err = tp.error();
      if (err) toast.error(err.message);
    }
  }

  const isSelected = (modelId: string) => tp.selectedModelId() === modelId;

  async function handleDeleteServer() {
    const ok = await tp.deleteServer();
    if (ok) {
      toast.success(t("textProcessing.serverDeletedToast"));
    } else {
      const err = tp.error();
      if (err) toast.error(err.message);
    }
  }

  return (
    <>
      {/* Text Model Management */}
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiCpu class="size-4" />}>
            {t("textProcessing.modelManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent class="space-y-4">
          <For each={tp.models()}>
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
                  if (model.downloaded) tp.selectModel(model.id);
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
                          tp.isDownloading() &&
                          tp.downloadingModelId() === model.id
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            class="w-28"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              handleDownloadModel(model.id);
                            }}
                            disabled={tp.isDownloading()}
                          >
                            <FiDownload />
                            {t("common.download")}
                          </Button>
                        }
                      >
                        <div class="w-28 space-y-1">
                          <Progress
                            value={
                              tp.downloadPhase() === "server"
                                ? 0
                                : (tp.downloadProgress()?.progress ?? 0)
                            }
                            minValue={0}
                            maxValue={100}
                          />
                          <p class="text-center text-xs text-muted-foreground">
                            {tp.downloadPhase() === "server"
                              ? t("textProcessing.settingUp")
                              : `${Math.round(tp.downloadProgress()?.progress ?? 0)}%`}
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
                          {t("textProcessing.deleteModel")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("textProcessing.deleteModelConfirmation", {
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
        </CardContent>
      </Card>

      {/* Server Management (dev mode only) */}
      <Show when={props.devMode}>
        <Card>
          <CardHeader>
            <CardTitleWithIcon icon={() => <FiServer class="size-4" />}>
              {t("textProcessing.serverManagement")}
            </CardTitleWithIcon>
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
                      tp.downloadPhase() === "server" &&
                      !tp.downloadingModelId()
                    }
                    fallback={
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-28"
                        onClick={handleDownloadServer}
                        disabled={tp.isDownloading()}
                      >
                        <FiDownload />
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
                <Button
                  variant="destructive"
                  size="sm"
                  class="w-28"
                  onClick={handleDeleteServer}
                >
                  <FiTrash2 />
                  {t("common.delete")}
                </Button>
              </Show>
            </div>
          </CardContent>
        </Card>
      </Show>
    </>
  );
}
