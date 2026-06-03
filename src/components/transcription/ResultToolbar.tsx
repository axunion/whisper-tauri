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
import { TbOutlineSparkles, TbOutlineSubtask } from "solid-icons/tb";
import type { Component, JSX } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/DropdownMenu";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import type { ExportFormat } from "~/lib/export";

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
  onDirectSave: () => void;
  onSummarize: () => void;
  onCleanText: () => void;
  onGenerateTitle: () => void;
  onShareToNotion: () => void;
  onOpenNotionSetup: () => void;
  isProcessing: boolean;
  isGeneratingTitle: boolean;
  isNotionConnected: boolean;
  isSharingToNotion: boolean;
  canSave: boolean;
}

const dropdownIconClass = "size-4 shrink-0 text-violet-500";

const ResultToolbar: Component<ResultToolbarProps> = (props) => {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);

  const isTextProcessingTab = () =>
    props.activeTab === "summary" || props.activeTab === "cleanText";

  function handleCopy() {
    props.onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
              aria-label={t("result.close")}
              title={t("result.close")}
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
        <DropdownMenu>
          <DropdownMenuTrigger
            as={Button}
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={props.isProcessing || props.isGeneratingTitle}
            aria-label={t("result.aiMenu")}
            title={t("result.aiMenu")}
          >
            <TbOutlineSparkles class="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              disabled={props.isGeneratingTitle}
              onSelect={() => props.onGenerateTitle()}
            >
              <FiType class={dropdownIconClass} />
              {t("textProcessing.generateTitle")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={props.isProcessing}
              onSelect={() => props.onCleanText()}
            >
              <FiAlignLeft class={dropdownIconClass} />
              {t("textProcessing.cleanText")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={props.isProcessing}
              onSelect={() => props.onSummarize()}
            >
              <TbOutlineSubtask class={dropdownIconClass} />
              {t("textProcessing.summarize")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Share menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            as={Button}
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={props.isSharingToNotion}
            aria-label={t("result.shareMenu")}
            title={t("result.shareMenu")}
          >
            <FiShare2 class="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <Show
              when={props.isNotionConnected}
              fallback={
                <>
                  <DropdownMenuItem disabled>
                    <SiNotion class={dropdownIconClass} />
                    {t("result.shareToNotion")}
                  </DropdownMenuItem>
                  {/* Disabled items are skipped by Kobalte's focus order, so the
                      reason must be conveyed by a visible (non-item) line rather
                      than an unreachable aria-label/title on the disabled item. */}
                  <p class="px-3 pb-1 pt-0.5 text-xs text-muted-foreground">
                    {t("result.shareToNotionDisabledHint")}
                  </p>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => props.onOpenNotionSetup()}>
                    <FiSettings class={dropdownIconClass} />
                    {t("result.shareNotionSetupHint")}
                  </DropdownMenuItem>
                </>
              }
            >
              <DropdownMenuItem
                disabled={props.isSharingToNotion}
                onSelect={() => props.onShareToNotion()}
              >
                <SiNotion class={dropdownIconClass} />
                {t("result.shareToNotion")}
              </DropdownMenuItem>
            </Show>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* summary/cleanText have a single output format, so no flyout. */}
        <Show
          when={!isTextProcessingTab()}
          fallback={
            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              disabled={!props.canSave}
              onClick={props.onDirectSave}
              aria-label={t("result.saveMenu")}
              title={t("result.saveMenu")}
            >
              <FiDownload class="size-4" />
            </Button>
          }
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              as={Button}
              variant="ghost"
              size="icon"
              class="size-8"
              disabled={!props.canSave}
              aria-label={t("result.saveMenu")}
              title={t("result.saveMenu")}
            >
              <FiDownload class="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <For each={FORMAT_OPTIONS}>
                {(opt) => (
                  <DropdownMenuItem onSelect={() => props.onSave(opt.value)}>
                    <opt.icon class={dropdownIconClass} />
                    {t(opt.labelKey)}
                  </DropdownMenuItem>
                )}
              </For>
            </DropdownMenuContent>
          </DropdownMenu>
        </Show>

        {/* Copy */}
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          disabled={props.isProcessing}
          onClick={handleCopy}
          aria-label={t("result.copy")}
          title={t("result.copy")}
        >
          <Show when={copied()} fallback={<FiCopy class="size-4" />}>
            <FiCheck class="size-4" />
          </Show>
        </Button>
      </div>
    </div>
  );
};

export type { ResultTab };
export { ResultToolbar };
