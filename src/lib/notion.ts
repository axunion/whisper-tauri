import type { DictionaryKey, Locale } from "~/i18n";
import { formatDate, formatDuration } from "~/lib/format";
import type {
  NotionMetaField,
  NotionPagePayload,
  NotionSummary,
  NotionSummaryLabels,
  StructuredSummary,
} from "~/types";

type TranslateFn = (
  key: DictionaryKey,
  params?: Record<string, string | number>,
) => string;

function summaryLabels(t: TranslateFn): NotionSummaryLabels {
  return {
    tldr: t("textProcessing.summaryTldr"),
    keyPoints: t("textProcessing.summaryKeyPoints"),
    actionItems: t("textProcessing.summaryActionItems"),
    keywords: t("textProcessing.summaryKeywords"),
    due: t("textProcessing.summaryActionDue"),
  };
}

export interface NotionMetaContext {
  createdAt?: string | undefined;
  modelId?: string | undefined;
  processingMs?: number | undefined;
  duration?: number | undefined;
  fileName?: string | undefined;
  vadEnabled?: boolean | null | undefined;
}

export interface BuildNotionPagePayloadOptions {
  title: string;
  body: string;
  meta: NotionMetaContext;
  summary: StructuredSummary | null;
  t: TranslateFn;
  locale: Locale;
}

/**
 * Maps a `StructuredSummary` to the Notion payload shape. Returns null when
 * every section is empty so the caller can skip the entire summary block
 * group. The headline rides along as a leading `heading_1` block; the page
 * title properties separately receive `"<fileName> (要約)"` so there is no
 * duplication.
 */
export function summaryToNotionPayload(
  summary: StructuredSummary | null,
  t: TranslateFn,
): NotionSummary | null {
  if (!summary) return null;
  const headline = summary.headline.trim();
  const tldr = summary.tldr.trim();
  const isEmpty =
    headline.length === 0 &&
    tldr.length === 0 &&
    summary.keyPoints.length === 0 &&
    summary.actionItems.length === 0 &&
    summary.keywords.length === 0;
  if (isEmpty) return null;
  return {
    headline,
    tldr,
    keyPoints: summary.keyPoints,
    actionItems: summary.actionItems.map((item) =>
      item.due === undefined ? { what: item.what } : item,
    ),
    keywords: summary.keywords,
    labels: summaryLabels(t),
  };
}

function buildMetaFields(
  meta: NotionMetaContext,
  t: TranslateFn,
  locale: Locale,
): NotionMetaField[] {
  const fields: NotionMetaField[] = [];

  if (meta.createdAt) {
    fields.push({
      label: t("notionShare.metaCreatedAt"),
      value: formatDate(meta.createdAt, locale),
    });
  }
  if (meta.fileName) {
    fields.push({
      label: t("notionShare.metaFileName"),
      value: meta.fileName,
    });
  }
  if (meta.modelId) {
    fields.push({
      label: t("notionShare.metaModel"),
      value: meta.modelId,
    });
  }
  if (typeof meta.duration === "number" && meta.duration > 0) {
    fields.push({
      label: t("notionShare.metaAudioLength"),
      value: formatDuration(meta.duration),
    });
  }
  if (typeof meta.processingMs === "number" && meta.processingMs > 0) {
    fields.push({
      label: t("notionShare.metaProcessingTime"),
      value: formatDuration(meta.processingMs),
    });
  }
  if (typeof meta.vadEnabled === "boolean") {
    fields.push({
      label: t("notionShare.metaVadEnabled"),
      value: meta.vadEnabled
        ? t("notionShare.metaVadOn")
        : t("notionShare.metaVadOff"),
    });
  }

  return fields;
}

export function buildNotionPagePayload(
  options: BuildNotionPagePayloadOptions,
): NotionPagePayload {
  return {
    title: options.title.trim() || options.t("notionShare.titleUntitled"),
    meta: buildMetaFields(options.meta, options.t, options.locale),
    summary: summaryToNotionPayload(options.summary, options.t),
    bodyText: options.body,
  };
}
