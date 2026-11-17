import { useLocation, useNavigate } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import { onCleanup, onMount } from "solid-js";
import { useI18n } from "~/i18n";
import { AUDIO_EXTENSIONS, HISTORY_SEARCH_ID } from "~/lib/constants";
import { createRecording } from "~/primitives/createRecording";
import { createTranscriptionJob } from "~/primitives/createTranscriptionJob";

/**
 * The platform's shortcut modifier: Cmd on macOS, Ctrl elsewhere. On macOS
 * Ctrl+F and Ctrl+O are text-editing keys (forward-char, open-line) and must
 * keep working inside inputs.
 */
function hasShortcutModifier(e: KeyboardEvent): boolean {
  const isMac = /Mac/.test(navigator.platform);
  return isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

/**
 * App-wide keyboard shortcuts (Cmd on macOS, Ctrl elsewhere):
 * - O: pick audio files to transcribe
 * - F: search the history
 * - ,: open settings
 */
export function Shortcuts() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const job = createTranscriptionJob();
  const recording = createRecording();

  async function openFiles(): Promise<void> {
    // The same limits as dropping files: not into a recording in progress,
    // and not over a result the user has not finished with.
    if (recording.isRecording() || job.phase() === "done") return;
    const paths = await open({
      multiple: true,
      title: t("dialog.openAudioTitle"),
      filters: [
        { name: t("dialog.audioFilter"), extensions: AUDIO_EXTENSIONS },
      ],
    });
    if (paths && paths.length > 0) {
      navigate("/transcription", { state: { filePaths: paths } });
    }
  }

  function searchHistory(): void {
    if (location.pathname === "/history") {
      document.getElementById(HISTORY_SEARCH_ID)?.focus();
    } else {
      navigate("/history", { state: { focusSearch: true } });
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!hasShortcutModifier(e) || e.altKey || e.shiftKey) return;
    // Lower-cased: Caps Lock reports the letter in upper case.
    const key = e.key.toLowerCase();
    if (key === "o") {
      e.preventDefault();
      openFiles().catch(console.error);
    } else if (key === "f") {
      e.preventDefault();
      searchHistory();
    } else if (key === ",") {
      e.preventDefault();
      navigate("/settings");
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return null;
}
