import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
import { useI18n } from "~/i18n";
import type { StructuredSummary } from "~/types";
import { ResultProcessingShell } from "./ResultProcessingShell";

interface ResultSummaryTabProps {
  summaryResult: StructuredSummary | null;
  isProcessing: boolean;
  onCancel: () => void;
}

function Section(props: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="mt-6 first:mt-0">
      <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {props.title}
      </p>
      {props.children}
    </div>
  );
}

function BulletList(props: { items: string[] }): JSX.Element {
  return (
    <ul class="space-y-2 pl-4">
      <For each={props.items}>
        {(item) => (
          <li class="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
            <span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
            <span>{item}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

const ResultSummaryTab: Component<ResultSummaryTabProps> = (props) => {
  const { t } = useI18n();

  const summary = (): StructuredSummary | null => props.summaryResult;

  const hasContent = (): boolean => {
    const s = summary();
    if (!s) return false;
    return (
      s.headline.length > 0 ||
      s.tldr.length > 0 ||
      s.keywords.length > 0 ||
      s.actionItems.length > 0 ||
      s.keyPoints.length > 0
    );
  };

  return (
    <ResultProcessingShell
      isProcessing={props.isProcessing}
      processingLabel={t("textProcessing.summarizing")}
      onCancel={props.onCancel}
      hasResult={summary() !== null}
    >
      <Show
        when={hasContent()}
        fallback={<p class="text-sm text-muted-foreground">—</p>}
      >
        <Show when={summary()?.headline}>
          {(headline) => (
            <p class="text-lg font-semibold leading-snug text-foreground">
              {headline()}
            </p>
          )}
        </Show>

        <Show when={summary()?.tldr}>
          {(tldr) => (
            <Section title={t("textProcessing.summaryTldr")}>
              <p class="text-sm leading-relaxed text-foreground/85">{tldr()}</p>
            </Section>
          )}
        </Show>

        <Show when={(summary()?.keyPoints ?? []).length > 0}>
          <Section title={t("textProcessing.summaryKeyPoints")}>
            <BulletList items={summary()?.keyPoints ?? []} />
          </Section>
        </Show>

        <Show when={(summary()?.actionItems ?? []).length > 0}>
          <Section title={t("textProcessing.summaryActionItems")}>
            <ul class="space-y-2 pl-4">
              <For each={summary()?.actionItems ?? []}>
                {(item) => (
                  <li class="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
                    <span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>
                      {item.what}
                      <Show when={item.due}>
                        {(due) => (
                          <span class="ml-2 text-xs text-muted-foreground">
                            ({t("textProcessing.summaryActionDue")}: {due()})
                          </span>
                        )}
                      </Show>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Section>
        </Show>

        <Show when={(summary()?.keywords ?? []).length > 0}>
          <Section title={t("textProcessing.summaryKeywords")}>
            <div class="flex flex-wrap gap-1.5">
              <For each={summary()?.keywords ?? []}>
                {(kw) => (
                  <span class="rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-foreground/80">
                    {kw}
                  </span>
                )}
              </For>
            </div>
          </Section>
        </Show>
      </Show>
    </ResultProcessingShell>
  );
};

export { ResultSummaryTab };
