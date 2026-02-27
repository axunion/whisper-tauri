import type { Component } from "solid-js";
import { ResultViewer } from "~/components/transcription/ResultViewer";
import { useI18n } from "~/i18n";
import type { HistoryEntry, TranscriptionResult } from "~/types";

interface HistoryDetailProps {
  entry: HistoryEntry;
}

function toTranscriptionResult(entry: HistoryEntry): TranscriptionResult {
  return {
    taskId: entry.id,
    text: entry.text,
    segments: entry.segments,
    language: entry.language,
    duration: entry.duration,
  };
}

const HistoryDetail: Component<HistoryDetailProps> = (props) => {
  const { t, locale } = useI18n();

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString(locale() === "ja" ? "ja-JP" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const result = () => toTranscriptionResult(props.entry);

  return (
    <div class="flex flex-1 flex-col gap-4 overflow-hidden">
      <div>
        <h3 class="text-base font-semibold">{props.entry.fileName}</h3>
        <p class="text-xs text-muted-foreground">
          {formatDate(props.entry.createdAt)} | {t("history.modelLabel")}{" "}
          {props.entry.modelId}
        </p>
      </div>
      <div class="flex-1 overflow-y-auto">
        <ResultViewer result={result()} />
      </div>
    </div>
  );
};

export { HistoryDetail };
