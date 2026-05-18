import { FiArchive, FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, For, onMount, Show } from "solid-js";
import { Badge } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { SectionRow } from "~/components/ui/SectionRow";
import { useI18n } from "~/i18n";
import { formatBytes } from "~/lib/format";
import { toast } from "~/lib/toast";
import { createTextProcessing } from "~/primitives/createTextProcessing";

interface LegacyTextModelListProps {
  textProcessing?: ReturnType<typeof createTextProcessing>;
}

const LegacyTextModelList: Component<LegacyTextModelListProps> = (props) => {
  const { t } = useI18n();
  const tp = props.textProcessing ?? createTextProcessing();
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  onMount(() => {
    tp.loadLegacyModels();
  });

  async function handleDelete(modelId: string) {
    setDeletingId(modelId);
    try {
      await tp.deleteLegacyModel(modelId);
      toast.success(
        t("textProcessing.legacyModelDeletedToast", { id: modelId }),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Show when={tp.legacyModels().length > 0}>
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={() => <FiArchive class="size-4" />}>
            {t("textProcessing.legacyModelsTitle")}
          </CardTitleWithIcon>
        </CardHeader>
        <CardContent class="space-y-4">
          <p class="text-sm text-muted-foreground">
            {t("textProcessing.legacyModelsDescription")}
          </p>
          <For each={tp.legacyModels()}>
            {(model) => (
              <SectionRow
                title={
                  <span class="flex items-center gap-2">
                    <span>{model.id}</span>
                    <Badge variant="outline">
                      {t("textProcessing.legacyModelBadge")}
                    </Badge>
                  </span>
                }
                description={formatBytes(model.sizeBytes)}
                right={
                  <ConfirmDialog
                    title={t("textProcessing.deleteModel")}
                    description={t(
                      "textProcessing.deleteLegacyModelConfirmation",
                      { id: model.id },
                    )}
                    confirmLabel={
                      <>
                        <FiTrash2 />
                        {t("common.delete")}
                      </>
                    }
                    onConfirm={() => handleDelete(model.id)}
                  >
                    {(openDialog) => (
                      <Button
                        variant="destructive"
                        size="sm"
                        class="w-28"
                        disabled={deletingId() === model.id}
                        onClick={openDialog}
                      >
                        <FiTrash2 />
                        {deletingId() === model.id
                          ? t("common.deleting")
                          : t("common.delete")}
                      </Button>
                    )}
                  </ConfirmDialog>
                }
              />
            )}
          </For>
        </CardContent>
      </Card>
    </Show>
  );
};

export { LegacyTextModelList };
