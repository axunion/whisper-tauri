import { FiCpu, FiServer } from "solid-icons/fi";
import { createSignal, For, onMount, Show } from "solid-js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { HelpHint } from "~/components/ui/HelpHint";
import { ModelDownloadAction } from "~/components/ui/ModelDownloadAction";
import { ModelListItem } from "~/components/ui/ModelListItem";
import { SectionRow } from "~/components/ui/SectionRow";
import { TotalSizeFooter } from "~/components/ui/TotalSizeFooter";
import { useI18n } from "~/i18n";
import { runWithToast } from "~/lib/actionToast";
import { getModelDescription } from "~/lib/modelDescription";
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
    try {
      await runWithToast({
        action: () => tp.deleteModel(modelId),
        successKey: "textProcessing.modelDeletedToast",
        error: tp.error,
        t,
      });
    } finally {
      setDeletingModelId(null);
    }
  }

  async function handleDownloadModel(modelId: string) {
    await runWithToast({
      action: () => tp.downloadModel(modelId),
      successKey: "textProcessing.modelDownloadedToast",
      error: tp.error,
      t,
    });
  }

  async function handleDownloadServer() {
    await runWithToast({
      action: () => tp.downloadServer(),
      successKey: "textProcessing.serverDownloadedToast",
      error: tp.error,
      t,
    });
  }

  async function handleDeleteServer() {
    await runWithToast({
      action: () => tp.deleteServer(),
      successKey: "textProcessing.serverDeletedToast",
      error: tp.error,
      t,
    });
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
          <div
            class="space-y-4"
            role="radiogroup"
            aria-label={t("textProcessing.modelManagement")}
          >
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
                    <ModelDownloadAction
                      downloaded={model.downloaded}
                      downloading={
                        tp.isDownloading() &&
                        tp.downloadingModelId() === model.id
                      }
                      progress={tp.downloadProgress()?.progress ?? 0}
                      progressLabel={
                        tp.downloadPhase() === "server"
                          ? t("textProcessing.settingUp")
                          : undefined
                      }
                      downloadDisabled={tp.isDownloading()}
                      onDownload={() => handleDownloadModel(model.id)}
                      deleteTitle={t("textProcessing.deleteModel")}
                      deleteDescription={t(
                        "textProcessing.deleteModelConfirmation",
                        { name: model.name },
                      )}
                      deleting={deletingModelId() === model.id}
                      onDelete={() => handleDeleteModel(model.id)}
                    />
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
                <ModelDownloadAction
                  downloaded={tp.serverAvailable()}
                  downloading={
                    tp.downloadPhase() === "server" && !tp.downloadingModelId()
                  }
                  progress={tp.downloadProgress()?.progress ?? 0}
                  downloadDisabled={tp.isDownloading()}
                  onDownload={handleDownloadServer}
                  deleteTitle={t("textProcessing.deleteServer")}
                  deleteDescription={t(
                    "textProcessing.deleteServerConfirmation",
                  )}
                  onDelete={handleDeleteServer}
                />
              }
            />
          </CardContent>
        </Card>
      </Show>
    </>
  );
}
