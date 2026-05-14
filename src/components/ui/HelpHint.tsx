import * as PopoverPrimitive from "@kobalte/core/popover";
import { FiHelpCircle } from "solid-icons/fi";
import type { Component } from "solid-js";
import { useI18n } from "~/i18n";

export type GlossaryTerm =
  | "vad"
  | "llm"
  | "whisper"
  | "ffmpeg"
  | "notionDatabaseId"
  | "notionToken";

interface HelpHintProps {
  term: GlossaryTerm;
}

export const HelpHint: Component<HelpHintProps> = (props) => {
  const { t } = useI18n();
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        class="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("common.helpHintLabel")}
      >
        <FiHelpCircle class="size-3.5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content class="z-50 w-72 rounded-md border border-border/30 bg-popover/55 p-3 text-popover-foreground shadow-md outline-none backdrop-blur-xl">
          <div class="space-y-1.5">
            <div class="text-sm font-semibold">
              {t(`glossary.${props.term}.title`)}
            </div>
            <p class="text-xs leading-relaxed text-muted-foreground">
              {t(`glossary.${props.term}.body`)}
            </p>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
