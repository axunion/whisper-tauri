import { FiCheckSquare, FiTrash2 } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/AlertDialog";
import { Button } from "~/components/ui/Button";

interface HistoryActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

const HistoryActions: Component<HistoryActionsProps> = (props) => {
  const [deleteSelectedOpen, setDeleteSelectedOpen] = createSignal(false);

  const allSelected = () =>
    props.totalCount > 0 && props.selectedCount === props.totalCount;

  return (
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          allSelected() ? props.onClearSelection() : props.onSelectAll()
        }
        disabled={props.totalCount === 0}
      >
        <FiCheckSquare class="size-4" />
        {allSelected() ? "Deselect All" : "Select All"}
      </Button>

      <Show when={props.selectedCount > 0}>
        <AlertDialog
          open={deleteSelectedOpen()}
          onOpenChange={setDeleteSelectedOpen}
        >
          <AlertDialogTrigger as={Button} variant="destructive" size="sm">
            <FiTrash2 class="size-4" />
            Delete ({props.selectedCount})
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Delete Selected</AlertDialogTitle>
            <AlertDialogDescription>
              {props.selectedCount} entries will be permanently deleted. This
              action cannot be undone.
            </AlertDialogDescription>
            <div class="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteSelectedOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  props.onDeleteSelected();
                  setDeleteSelectedOpen(false);
                }}
              >
                Delete
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </Show>
    </div>
  );
};

export { HistoryActions };
