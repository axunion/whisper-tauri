import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { ModelDownloadAction } from "~/components/ui/ModelDownloadAction";
import { ModelListItem } from "~/components/ui/ModelListItem";
import { useI18n } from "~/i18n";
import type { DictionaryKey } from "~/i18n/types";
import { getModelDescription } from "~/lib/modelDescription";
import { toast } from "~/lib/toast";
import type { createWhisper } from "~/primitives/createWhisper";

export interface WhisperModelListLabels {
  deletedToast: DictionaryKey;
  deleteTitle: DictionaryKey;
  /** Description with `{name}` placeholder for the model being deleted. */
  deleteDescription: DictionaryKey;
  emptyState: DictionaryKey;
}

interface WhisperModelListProps {
  whisper: ReturnType<typeof createWhisper>;
  labels: WhisperModelListLabels;
}

const WhisperModelList: Component<WhisperModelListProps> = (props) => {
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
      toast.success(t(props.labels.deletedToast));
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
              <ModelDownloadAction
                downloaded={model.downloaded}
                downloading={
                  props.whisper.isDownloading() &&
                  props.whisper.downloadProgress()?.modelId === model.id
                }
                progress={props.whisper.downloadProgress()?.progress ?? 0}
                downloadDisabled={props.whisper.isDownloading()}
                onDownload={() => props.whisper.downloadModel(model.id)}
                deleteTitle={t(props.labels.deleteTitle)}
                deleteDescription={t(props.labels.deleteDescription, {
                  name: model.name,
                })}
                deleting={deletingModelId() === model.id}
                onDelete={() => handleDeleteModel(model.id)}
              />
            }
          />
        )}
      </For>
      <Show when={props.whisper.models().length === 0}>
        <p class="text-sm text-muted-foreground">
          {t(props.labels.emptyState)}
        </p>
      </Show>
    </div>
  );
};

export { WhisperModelList };
