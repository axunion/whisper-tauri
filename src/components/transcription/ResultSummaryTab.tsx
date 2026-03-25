import { FiX } from "solid-icons/fi";
import type { Component, JSX } from "solid-js";
import { createMemo, For, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";

interface ResultSummaryTabProps {
  summaryResult: string | null;
  isProcessing: boolean;
  onCancel: () => void;
}

interface SummarySection {
  heading: string;
  items: string[];
}

/** Strip inline markdown syntax: **bold**, *italic*, `code`, [link](url) → plain text. */
function stripInlineMarkdown(text: string): string {
  return (
    text
      // **bold** or __bold__
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      // *italic* or _italic_
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1")
      // `code`
      .replace(/`(.+?)`/g, "$1")
      // [text](url) → text
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
  );
}

/** Parse structured summary (### headings + - items) into sections. */
function parseSections(text: string): SummarySection[] {
  const sections: SummarySection[] = [];
  let current: SummarySection | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)/);
    if (headingMatch) {
      current = {
        heading: stripInlineMarkdown(headingMatch[1]?.trim() ?? ""),
        items: [],
      };
      sections.push(current);
      continue;
    }

    const listMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)/);
    if (listMatch && current) {
      current.items.push(stripInlineMarkdown(listMatch[1]?.trim() ?? ""));
      continue;
    }

    const cleaned = stripInlineMarkdown(trimmed);
    if (current) {
      current.items.push(cleaned);
    } else {
      current = { heading: "", items: [cleaned] };
      sections.push(current);
    }
  }

  return sections;
}

function renderStructuredSummary(sections: SummarySection[]): JSX.Element {
  if (sections.length === 0) {
    return <p class="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div class="flex flex-col">
      <For each={sections}>
        {(section, i) => (
          <div class={i() > 0 ? "mt-6" : ""}>
            <Show when={section.heading}>
              <h3 class="mb-3 font-semibold">{section.heading}</h3>
            </Show>
            <ul class="space-y-2 pl-4">
              <For each={section.items}>
                {(item) => (
                  <li class="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
                    <span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{item}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>
    </div>
  );
}

const ResultSummaryTab: Component<ResultSummaryTabProps> = (props) => {
  const { t } = useI18n();

  const hasResult = () => props.summaryResult !== null;
  const sections = createMemo(() => {
    const text = props.summaryResult;
    return text ? parseSections(text) : [];
  });

  return (
    <div class="flex h-full flex-col overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <Show when={props.isProcessing}>
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <p class="animate-pulse text-sm text-muted-foreground">
            {t("textProcessing.summarizing")}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5"
            onClick={props.onCancel}
          >
            <FiX class="size-3.5" />
            {t("common.cancel")}
          </Button>
        </div>
      </Show>

      <Show when={hasResult() && !props.isProcessing}>
        {renderStructuredSummary(sections())}
      </Show>
    </div>
  );
};

export { ResultSummaryTab };
