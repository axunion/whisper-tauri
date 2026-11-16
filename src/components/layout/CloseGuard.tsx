import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { onCleanup, onMount } from "solid-js";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";
import { createRecording } from "~/primitives/createRecording";
import { createTranscriptionJob } from "~/primitives/createTranscriptionJob";

/**
 * Asks before the window closes while closing would lose work: a recording in
 * progress, a recording not yet transcribed, or a running transcription.
 */
export function CloseGuard() {
  const { t } = useI18n();
  const recording = createRecording();
  const job = createTranscriptionJob();

  function workAtRisk(): DictionaryKey | null {
    if (recording.isRecording()) return "closeGuard.recording";
    if (job.isRunning()) return "closeGuard.processing";
    if (recording.tempFilePath() !== null) return "closeGuard.unsavedRecording";
    return null;
  }

  onMount(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      const messageKey = workAtRisk();
      if (!messageKey) return;
      const quit = await confirm(t(messageKey), {
        title: t("closeGuard.title"),
        kind: "warning",
        okLabel: t("closeGuard.quit"),
        cancelLabel: t("common.cancel"),
      });
      if (!quit) event.preventDefault();
    });
    onCleanup(() => {
      void unlisten.then((stop) => stop());
    });
  });

  return null;
}
