import type { Accessor, Setter } from "solid-js";
import { createSignal } from "solid-js";

export interface TitleEditor {
  editValue: Accessor<string>;
  setEditValue: Setter<string>;
  isEditing: Accessor<boolean>;
  startEditing: (initial: string) => void;
  confirm: () => void;
  cancel: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
}

export interface CreateTitleEditorOptions {
  /** Called with the trimmed value when the user confirms editing. */
  onConfirm: (value: string) => void;
}

export function createTitleEditor(
  options: CreateTitleEditorOptions,
): TitleEditor {
  const [editValue, setEditValue] = createSignal("");
  const [isEditing, setIsEditing] = createSignal(false);

  function startEditing(initial: string): void {
    setEditValue(initial);
    setIsEditing(true);
  }

  function confirm(): void {
    const trimmed = editValue().trim();
    if (trimmed) {
      options.onConfirm(trimmed);
    }
    setIsEditing(false);
  }

  function cancel(): void {
    setIsEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  return {
    editValue,
    setEditValue,
    isEditing,
    startEditing,
    confirm,
    cancel,
    handleKeyDown,
  };
}
