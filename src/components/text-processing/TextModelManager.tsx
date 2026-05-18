import { FiCpu, FiDownload, FiServer, FiTrash2 } from "solid-icons/fi";
import { createSignal, For, onMount, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { HelpHint } from "~/components/ui/HelpHint";
import { ModelListItem } from "~/components/ui/ModelListItem";
import { SectionRow } from "~/components/ui/SectionRow";
import { TotalSizeFooter } from "~/components/ui/TotalSizeFooter";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
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

  async function runWithToast(
    action: () => Promise<boolean>,
    successKey: DictionaryKey,
  ): Promise<void> {
    const ok = await action();
    if (ok) {
      toast.success(t(successKey));
    } else {
      const err = tp.error();
      if (err) toast.error(err.message);
    }
  }

  async function handleDeleteModel(modelId: string) {
    setDeletingModelId(modelId);
    await tp.deleteModel(modelId);
    setDeletingModelId(null);
    toast.success(t("textProcessing.modelDeletedToast"));
  }

  async function handleDownloadModel(modelId: string) {
    await runWithToast(
      () => tp.downloadModel(modelId),
      "textProcessing.modelDownloadedToast",
    );
  }

  async function handleDownloadServer() {
    await runWithToast(
      () => tp.downloadServer(),
      "textProcessing.serverDownloadedToast",
    );
  }

  async function handleDeleteServer() {
    await runWithToast(
      () => tp.deleteServer(),
      "textProcessing.serverDeletedToast",
    );
  }

  const isSelected = (modelId: string) => tp.selectedModelId() === modelId;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitleWithIcon
            icon={() => <FiCpu class="size-4" />}
            trailing={
              <Show when={!props.devMode}>
                <HelpHint term="llm" />
              </Show>
            }
          >
            {t("textProcessing.modelManagement")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-4" role="radiogroup">
            <For each={tp.models()}>
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
                  onSelect={() => tp.selectModel(model.id)}
                  actionSlot={
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
                              onClick={() => handleDownloadModel(model.id)}
                              disabled={tp.isDownloading()}
                            >
                              <FiDownload />
                              {t("common.download")}
                            </Button>
                          }
                        >
                          <DownloadProgress
                            progress={tp.downloadProgress()?.progress ?? 0}
                            label={
                              tp.downloadPhase() === "server"
                                ? t("textProcessing.settingUp")
                                : undefined
                            }
                          />
                        </Show>
                      }
                    >
                      <ConfirmDialog
                        title={t("textProcessing.deleteModel")}
                        description={t(
                          "textProcessing.deleteModelConfirmation",
                          {
                            name: model.name,
                          },
                        )}
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
          </div>
          <TotalSizeFooter bytes={tp.totalSizeBytes()} />
        </CardContent>
      </Card>

      <Show when={props.devMode}>
        <Card>
          <CardHeader>
            <CardTitleWithIcon icon={() => <FiServer class="size-4" />}>
              {t("textProcessing.serverManagement")}
            </CardTitleWithIcon>
          </CardHeader>
          <CardContent>
            <SectionRow
              title="llama-server"
              right={
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
                      <DownloadProgress
                        progress={tp.downloadProgress()?.progress ?? 0}
                      />
                    </Show>
                  }
                >
                  <ConfirmDialog
                    title={t("textProcessing.deleteServer")}
                    description={t("textProcessing.deleteServerConfirmation")}
                    confirmLabel={
                      <>
                        <FiTrash2 />
                        {t("common.delete")}
                      </>
                    }
                    onConfirm={handleDeleteServer}
                  >
                    {(openDialog) => (
                      <Button
                        variant="destructive"
                        size="sm"
                        class="w-28"
                        onClick={openDialog}
                      >
                        <FiTrash2 />
                        {t("common.delete")}
                      </Button>
                    )}
                  </ConfirmDialog>
                </Show>
              }
            />
          </CardContent>
        </Card>
      </Show>
    </>
  );
}
