import { FiSearch, FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useI18n } from "~/i18n";

interface SearchBarProps {
  onInput: (value: string) => void;
  onClear: () => void;
}

const SearchBar: Component<SearchBarProps> = (props) => {
  const { t } = useI18n();
  const [hasValue, setHasValue] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  function handleInput(
    e: InputEvent & { currentTarget: HTMLInputElement },
  ): void {
    const value = e.currentTarget.value;
    setHasValue(value.length > 0);
    props.onInput(value);
  }

  function handleClear(): void {
    if (inputRef) inputRef.value = "";
    setHasValue(false);
    props.onClear();
    inputRef?.focus();
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      handleClear();
    }
  }

  return (
    <div class="relative">
      <FiSearch class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        class="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground"
        placeholder={t("history.searchPlaceholder")}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      <Show when={hasValue()}>
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          onClick={handleClear}
        >
          <FiX class="size-4" />
        </button>
      </Show>
    </div>
  );
};

export { SearchBar };
