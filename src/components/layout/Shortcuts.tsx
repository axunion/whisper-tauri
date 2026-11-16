import { useLocation, useNavigate } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import { onCleanup, onMount } from "solid-js";
import { useI18n } from "~/i18n";
import { AUDIO_EXTENSIONS } from "~/lib/constants";

/** Id of the history search box, which Cmd/Ctrl+F focuses. */
export const HISTORY_SEARCH_ID = "history-search";

/**
 * App-wide keyboard shortcuts:
 * - Cmd/Ctrl+O: pick audio files to transcribe
 * - Cmd/Ctrl+F: search the history
 * - Cmd/Ctrl+,: open settings
 */
export function Shortcuts() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  async function openFiles(): Promise<void> {
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
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const action =
      e.key === "o"
        ? openFiles
        : e.key === "f"
          ? searchHistory
          : e.key === ","
            ? () => navigate("/settings")
            : undefined;
    if (!action) return;
    e.preventDefault();
    void action();
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return null;
}
