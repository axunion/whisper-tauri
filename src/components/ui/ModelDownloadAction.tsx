import { FiDownload, FiTrash2 } from "solid-icons/fi";
import { Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { DownloadProgress } from "~/components/ui/DownloadProgress";
import { useI18n } from "~/i18n";

interface ModelDownloadActionProps {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  progressLabel?: string | undefined;
  downloadDisabled: boolean;
  onDownload: () => void;
  deleteTitle: string;
  deleteDescription: string;
  deleting?: boolean | undefined;
  onDelete: () => void;
}

/**
 * Three-state action slot for a downloadable model/tool row:
 * delete button with confirm dialog (downloaded) / progress (downloading) /
 * download button (otherwise).
 */
export function ModelDownloadAction(props: ModelDownloadActionProps) {
  const { t } = useI18n();

  return (
    <Show
      when={props.downloaded}
      fallback={
        <Show
          when={props.downloading}
          fallback={
            <Button
              variant="outline"
              size="sm"
              class="w-28"
              onClick={() => props.onDownload()}
              disabled={props.downloadDisabled}
            >
              <FiDownload />
              {t("common.download")}
            </Button>
          }
        >
          <DownloadProgress
            progress={props.progress}
            label={props.progressLabel}
          />
        </Show>
      }
    >
      <ConfirmDialog
        title={props.deleteTitle}
        description={props.deleteDescription}
        confirmLabel={
          <>
            <FiTrash2 />
            {t("common.delete")}
          </>
        }
        onConfirm={() => props.onDelete()}
      >
        {(openDialog) => (
          <Button
            variant="destructive"
            size="sm"
            class="w-28"
            disabled={props.deleting}
            onClick={openDialog}
          >
            <FiTrash2 />
            {props.deleting ? t("common.deleting") : t("common.delete")}
          </Button>
        )}
      </ConfirmDialog>
    </Show>
  );
}
