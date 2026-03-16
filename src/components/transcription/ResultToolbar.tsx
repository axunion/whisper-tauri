import { FiArrowLeft, FiCheck, FiCopy, FiDownload, FiX } from "solid-icons/fi";
import { TbSparkles } from "solid-icons/tb";
import type { Component } from "solid-js";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";
import { cn } from "~/lib/utils";

type ResultTab = "text" | "timeline" | "proofread" | "summary";

const FORMAT_OPTIONS: { value: ExportFormat; labelKey: DictionaryKey }[] = [
  { value: "txt", labelKey: "result.exportTxt" },
  { value: "srt", labelKey: "result.exportSrt" },
  { value: "vtt", labelKey: "result.exportVtt" },
];

interface ResultToolbarProps {
  fileName: string;
  activeTab: ResultTab;
  onClose?: (() => void) | undefined;
  onCopy: () => void;
  onSave: (format: ExportFormat) => void;
  onProofread: () => void;
  onSummarize: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const ResultToolbar: Component<ResultToolbarProps> = (props) => {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);
  const [saveOpen, setSaveOpen] = createSignal(false);
  const [aiOpen, setAiOpen] = createSignal(false);
  const [format, setFormat] = createSignal<ExportFormat>("txt");
  let saveRef: HTMLDivElement | undefined;
  let aiRef: HTMLDivElement | undefined;

  // Close dropdowns on outside click
  createEffect(() => {
    if (!saveOpen() && !aiOpen()) return;
    function handler(e: PointerEvent) {
      const target = e.target as Node;
      if (saveOpen() && saveRef && !saveRef.contains(target)) {
        setSaveOpen(false);
      }
      if (aiOpen() && aiRef && !aiRef.contains(target)) {
        setAiOpen(false);
      }
    }
    document.addEventListener("pointerdown", handler);
    onCleanup(() => document.removeEventListener("pointerdown", handler));
  });

  const isTextProcessingTab = () =>
    props.activeTab === "proofread" || props.activeTab === "summary";

  const isProcessingActive = () =>
    props.isProcessing &&
    (props.activeTab === "proofread" || props.activeTab === "summary");

  function handleCopy() {
    props.onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveWithFormat(fmt: ExportFormat) {
    setFormat(fmt);
    setSaveOpen(false);
    props.onSave(fmt);
  }

  const dropdownMenuClass =
    "absolute right-0 top-full z-50 mt-1 min-w-40 rounded-lg border border-border/30 bg-popover/55 p-1 shadow-md backdrop-blur-xl dark:bg-popover/35";
  const dropdownItemClass =
    "flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground";

  return (
    <div class="flex items-center justify-between">
      {/* Left: close + filename */}
      <div class="flex items-center gap-2">
        <Show when={props.onClose}>
          {(onClose) => (
            <Button
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground"
              onClick={onClose()}
            >
              <FiArrowLeft class="size-4" />
            </Button>
          )}
        </Show>
        <span class="truncate text-sm text-muted-foreground">
          {props.fileName}
        </span>
      </div>

      {/* Right: actions */}
      <div class="flex items-center gap-1">
        {/* AI menu */}
        <div ref={aiRef} class="relative">
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={props.isProcessing}
            onClick={() => setAiOpen(!aiOpen())}
          >
            <TbSparkles class="size-4" />
          </Button>
          <Show when={aiOpen()}>
            <div class={dropdownMenuClass}>
              <button
                type="button"
                class={dropdownItemClass}
                onClick={() => {
                  setAiOpen(false);
                  props.onProofread();
                }}
              >
                {t("textProcessing.proofread")}
              </button>
              <button
                type="button"
                class={dropdownItemClass}
                onClick={() => {
                  setAiOpen(false);
                  props.onSummarize();
                }}
              >
                {t("textProcessing.summarize")}
              </button>
            </div>
          </Show>
        </div>

        <Show
          when={!isProcessingActive()}
          fallback={
            <Button
              variant="ghost"
              size="icon"
              class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={props.onCancel}
            >
              <FiX class="size-4" />
            </Button>
          }
        >
          {/* Save with format flyout (only for text/timeline) */}
          <Show when={!isTextProcessingTab()}>
            <div ref={saveRef} class="relative">
              <Button
                variant="ghost"
                size="icon"
                class="size-8"
                onClick={() => setSaveOpen(!saveOpen())}
              >
                <FiDownload class="size-4" />
              </Button>
              <Show when={saveOpen()}>
                <div class={dropdownMenuClass}>
                  <For each={FORMAT_OPTIONS}>
                    {(opt) => (
                      <button
                        type="button"
                        class={cn(
                          dropdownItemClass,
                          format() === opt.value &&
                            "bg-accent text-accent-foreground",
                        )}
                        onClick={() => handleSaveWithFormat(opt.value)}
                      >
                        {t(opt.labelKey)}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* Copy */}
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            onClick={handleCopy}
          >
            <Show when={copied()} fallback={<FiCopy class="size-4" />}>
              <FiCheck class="size-4" />
            </Show>
          </Button>
        </Show>
      </div>
    </div>
  );
};

export { ResultToolbar };
export type { ResultTab };
