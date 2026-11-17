import { FiDatabase, FiTrash2 } from "solid-icons/fi";
import type { JSX } from "solid-js";
import { onMount, Show } from "solid-js";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitleWithIcon,
} from "~/components/ui/Card";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { SectionRow } from "~/components/ui/SectionRow";
import { Separator } from "~/components/ui/Separator";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import { runWithToast } from "~/lib/actionToast";
import { formatBytes } from "~/lib/format";
import { createStorage } from "~/primitives/createStorage";
import { createTranscriptionJob } from "~/primitives/createTranscriptionJob";

export default function DataManagement() {
  const { t } = useI18n();
  const storage = createStorage();
  // A re-transcription keeps running from other pages; deleting everything
  // meanwhile would take away the audio it is reading.
  const audioInUse = () => createTranscriptionJob().audioSourceId() !== null;

  onMount(() => {
    void storage.load();
  });

  function usage(count: number, bytes: number): string {
    return t("settings.storageUsage", { count, size: formatBytes(bytes) });
  }

  function deleteButton(options: {
    labelKey: DictionaryKey;
    confirmationKey: DictionaryKey;
    successKey: DictionaryKey;
    action: () => Promise<boolean>;
    disabled?: boolean;
  }): JSX.Element {
    return (
      <ConfirmDialog
        title={t(options.labelKey)}
        description={t(options.confirmationKey)}
        confirmLabel={
          <>
            <FiTrash2 />
            {t("common.delete")}
          </>
        }
        onConfirm={() =>
          runWithToast({
            action: options.action,
            successKey: options.successKey,
            error: storage.error,
            t,
          })
        }
      >
        {(openDialog) => (
          <Button
            variant="destructive"
            size="sm"
            class="shrink-0"
            disabled={options.disabled}
            onClick={openDialog}
          >
            <FiTrash2 />
            {t("common.delete")}
          </Button>
        )}
      </ConfirmDialog>
    );
  }

  return (
    <Card id="settings-data">
      <CardHeader>
        <CardTitleWithIcon icon={() => <FiDatabase class="size-4" />}>
          {t("settings.dataManagement")}
        </CardTitleWithIcon>
      </CardHeader>
      <CardContent class="space-y-6">
        <SectionRow
          title={t("settings.audioStorage")}
          description={usage(
            storage.stats()?.audioCount ?? 0,
            storage.stats()?.audioBytes ?? 0,
          )}
          right={deleteButton({
            labelKey: "settings.deleteAllAudio",
            confirmationKey: "settings.deleteAllAudioConfirmation",
            successKey: "settings.allAudioDeletedToast",
            action: storage.deleteAllAudio,
            disabled: (storage.stats()?.audioCount ?? 0) === 0 || audioInUse(),
          })}
        />

        {/* Recordings left behind by a crash or an interrupted run. */}
        <Show when={(storage.stats()?.pendingRecordingCount ?? 0) > 0}>
          <Separator />
          <SectionRow
            title={t("settings.pendingRecordings")}
            description={usage(
              storage.stats()?.pendingRecordingCount ?? 0,
              storage.stats()?.pendingRecordingBytes ?? 0,
            )}
            right={deleteButton({
              labelKey: "settings.deletePendingRecordings",
              confirmationKey: "settings.deletePendingRecordingsConfirmation",
              successKey: "settings.pendingRecordingsDeletedToast",
              action: storage.deletePendingRecordings,
            })}
          />
        </Show>

        <Separator />

        <SectionRow
          title={t("settings.deleteAllHistory")}
          description={t("settings.deleteAllHistoryDescription")}
          right={deleteButton({
            labelKey: "settings.deleteAllHistory",
            confirmationKey: "settings.deleteAllHistoryConfirmation",
            successKey: "settings.allHistoryDeletedToast",
            action: storage.deleteAllHistory,
            disabled: audioInUse(),
          })}
        />

        <ErrorDisplay error={storage.error()} onDismiss={storage.clearError} />
      </CardContent>
    </Card>
  );
}
