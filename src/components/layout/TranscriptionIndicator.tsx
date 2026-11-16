import { A } from "@solidjs/router";
import { FiFileText } from "solid-icons/fi";
import { Show } from "solid-js";
import { Progress } from "~/components/ui/Progress";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { useI18n } from "~/i18n";
import { createTranscriptionJob } from "~/primitives/createTranscriptionJob";
import { createWhisper } from "~/primitives/createWhisper";

/**
 * Sidebar indicator for a transcription run in flight. A run keeps going on
 * other pages, so this is how the user sees it from there — and gets back.
 */
export function TranscriptionIndicator() {
  const { t } = useI18n();
  const sidebar = useSidebar();
  const job = createTranscriptionJob();
  const whisper = createWhisper();

  const label = () =>
    job.phase() === "converting"
      ? t("transcription.converting")
      : t("common.transcribing");
  const progress = () => whisper.progress()?.progress ?? 0;

  // The live region covers only the label (changes once per phase), never the
  // per-tick percentage.
  return (
    <Show when={job.isRunning()}>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <A
              href="/transcription"
              class="block rounded-md hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <Show
                when={sidebar.state() === "expanded"}
                fallback={
                  <div class="flex justify-center py-2">
                    <FiFileText
                      class="size-4 animate-pulse text-primary"
                      aria-hidden="true"
                    />
                    <span class="sr-only" role="status" aria-live="polite">
                      {label()}
                    </span>
                  </div>
                }
              >
                <div class="space-y-1.5 px-2 py-2">
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <FiFileText
                      class="size-3 shrink-0 animate-pulse text-primary"
                      aria-hidden="true"
                    />
                    <span class="truncate" role="status" aria-live="polite">
                      {label()}
                    </span>
                    <Show when={job.phase() === "processing"}>
                      <span class="ml-auto tabular-nums">
                        {Math.round(progress())}%
                      </span>
                    </Show>
                  </div>
                  <Show
                    when={job.phase() === "processing"}
                    fallback={
                      <Progress
                        indeterminate
                        minValue={0}
                        maxValue={100}
                        aria-label={label()}
                      />
                    }
                  >
                    <Progress
                      value={progress()}
                      minValue={0}
                      maxValue={100}
                      aria-label={label()}
                    />
                  </Show>
                </div>
              </Show>
            </A>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </Show>
  );
}
