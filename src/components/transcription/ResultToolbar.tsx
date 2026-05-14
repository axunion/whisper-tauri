import type { IconTypes } from "solid-icons";
import {
  FiAlignLeft,
  FiArrowLeft,
  FiCheck,
  FiCopy,
  FiDownload,
  FiFileText,
  FiFilm,
  FiGlobe,
  FiSettings,
  FiShare2,
  FiType,
} from "solid-icons/fi";
import { SiNotion } from "solid-icons/si";
import { TbSparkles, TbSubtask } from "solid-icons/tb";
import type { Component, JSX } from "solid-js";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";
import { cn } from "~/lib/utils";

type ResultTab = "text" | "timeline" | "summary" | "cleanText";

const FORMAT_OPTIONS: {
  value: ExportFormat;
  labelKey: DictionaryKey;
  icon: IconTypes;
}[] = [
  { value: "txt", labelKey: "result.exportTxt", icon: FiFileText },
  { value: "srt", labelKey: "result.exportSrt", icon: FiFilm },
  { value: "vtt", labelKey: "result.exportVtt", icon: FiGlobe },
];

interface ResultToolbarProps {
  fileName?: JSX.Element | undefined;
  activeTab: ResultTab;
  onClose?: (() => void) | undefined;
  onCopy: () => void;
  onSave: (format: ExportFormat) => void;
  onSummarize: () => void;
  onCleanText: () => void;
  onGenerateTitle: () => void;
  onShareToNotion: () => void;
  onOpenNotionSetup: () => void;
  isProcessing: boolean;
  isGeneratingTitle: boolean;
  isNotionConnected: boolean;
  isSharingToNotion: boolean;
}

const ResultToolbar: Component<ResultToolbarProps> = (props) => {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);
  const [saveOpen, setSaveOpen] = createSignal(false);
  const [aiOpen, setAiOpen] = createSignal(false);
  const [shareOpen, setShareOpen] = createSignal(false);
  let saveRef: HTMLDivElement | undefined;
  let aiRef: HTMLDivElement | undefined;
  let shareRef: HTMLDivElement | undefined;

  // Close dropdowns on outside click
  createEffect(() => {
    if (!saveOpen() && !aiOpen() && !shareOpen()) return;
    function handler(e: PointerEvent) {
      const target = e.target as Node;
      if (saveOpen() && saveRef && !saveRef.contains(target)) {
        setSaveOpen(false);
      }
      if (aiOpen() && aiRef && !aiRef.contains(target)) {
        setAiOpen(false);
      }
      if (shareOpen() && shareRef && !shareRef.contains(target)) {
        setShareOpen(false);
      }
    }
    document.addEventListener("pointerdown", handler);
    onCleanup(() => document.removeEventListener("pointerdown", handler));
  });

  const isTextProcessingTab = () =>
    props.activeTab === "summary" || props.activeTab === "cleanText";

  function handleCopy() {
    props.onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveWithFormat(fmt: ExportFormat) {
    setSaveOpen(false);
    props.onSave(fmt);
  }

  const dropdownMenuClass =
    "absolute right-0 top-full z-50 mt-1 min-w-48 rounded-lg border border-border/30 bg-popover/80 p-1.5 shadow-md backdrop-blur-xl dark:bg-popover/65";
  const dropdownItemClass =
    "flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground";
  const dropdownIconClass = "size-4 shrink-0 text-violet-500";

  return (
    <div class="flex items-center justify-between">
      {/* Left: close + filename */}
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Show when={props.onClose}>
          {(onClose) => (
            <Button
              variant="ghost"
              size="icon"
              class="size-8 shrink-0 text-muted-foreground"
              onClick={onClose()}
            >
              <FiArrowLeft class="size-4" />
            </Button>
          )}
        </Show>
        <Show when={props.fileName}>
          <span class="truncate text-sm text-muted-foreground">
            {props.fileName}
          </span>
        </Show>
      </div>

      {/* Right: actions */}
      <div class="flex shrink-0 items-center gap-1">
        {/* AI menu */}
        <div ref={aiRef} class="relative">
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={props.isProcessing || props.isGeneratingTitle}
            onClick={() => setAiOpen(!aiOpen())}
          >
            <TbSparkles class="size-4" />
          </Button>
          <Show when={aiOpen()}>
            <div class={dropdownMenuClass}>
              <button
                type="button"
                class={cn(
                  dropdownItemClass,
                  props.isGeneratingTitle && "opacity-50",
                )}
                disabled={props.isGeneratingTitle}
                onClick={() => {
                  setAiOpen(false);
                  props.onGenerateTitle();
                }}
              >
                <FiType class={dropdownIconClass} />
                {t("textProcessing.generateTitle")}
              </button>
              <div class="my-1 border-t border-border/30" />
              <button
                type="button"
                class={dropdownItemClass}
                disabled={props.isProcessing}
                onClick={() => {
                  setAiOpen(false);
                  props.onCleanText();
                }}
              >
                <FiAlignLeft class={dropdownIconClass} />
                {t("textProcessing.cleanText")}
              </button>
              <button
                type="button"
                class={dropdownItemClass}
                disabled={props.isProcessing}
                onClick={() => {
                  setAiOpen(false);
                  props.onSummarize();
                }}
              >
                <TbSubtask class={dropdownIconClass} />
                {t("textProcessing.summarize")}
              </button>
            </div>
          </Show>
        </div>

        {/* Share menu */}
        <div ref={shareRef} class="relative">
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={props.isSharingToNotion}
            onClick={() => setShareOpen(!shareOpen())}
            aria-label={t("result.shareMenu")}
            title={t("result.shareMenu")}
          >
            <FiShare2 class="size-4" />
          </Button>
          <Show when={shareOpen()}>
            <div class={dropdownMenuClass}>
              <Show
                when={props.isNotionConnected}
                fallback={
                  <>
                    <button
                      type="button"
                      class={cn(dropdownItemClass, "opacity-50")}
                      disabled
                    >
                      <SiNotion class={dropdownIconClass} />
                      {t("result.shareToNotion")}
                    </button>
                    <div class="my-1 border-t border-border/30" />
                    <button
                      type="button"
                      class={dropdownItemClass}
                      onClick={() => {
                        setShareOpen(false);
                        props.onOpenNotionSetup();
                      }}
                    >
                      <FiSettings class={dropdownIconClass} />
                      {t("result.shareNotionSetupHint")}
                    </button>
                  </>
                }
              >
                <button
                  type="button"
                  class={dropdownItemClass}
                  disabled={props.isSharingToNotion}
                  onClick={() => {
                    setShareOpen(false);
                    props.onShareToNotion();
                  }}
                >
                  <SiNotion class={dropdownIconClass} />
                  {t("result.shareToNotion")}
                </button>
              </Show>
            </div>
          </Show>
        </div>

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
                      class={dropdownItemClass}
                      onClick={() => handleSaveWithFormat(opt.value)}
                    >
                      <opt.icon class={dropdownIconClass} />
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
          disabled={props.isProcessing}
          onClick={handleCopy}
        >
          <Show when={copied()} fallback={<FiCopy class="size-4" />}>
            <FiCheck class="size-4" />
          </Show>
        </Button>
      </div>
    </div>
  );
};

export { ResultToolbar };
export type { ResultTab };
