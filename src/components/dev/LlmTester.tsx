import { FiSend, FiX } from "solid-icons/fi";
import { createSignal, Show } from "solid-js";
import { useI18n } from "~/i18n";
import type { createTextProcessing } from "~/primitives/createTextProcessing";
import { Button } from "../ui/Button";

interface LlmTesterProps {
  textProcessing: ReturnType<typeof createTextProcessing>;
}

export function LlmTester(props: LlmTesterProps) {
  const { t } = useI18n();
  const [inputText, setInputText] = createSignal("");

  const hasDownloadedModel = () =>
    props.textProcessing.models().some((m) => m.downloaded);

  const isReady = () =>
    props.textProcessing.serverAvailable() && hasDownloadedModel();

  const canSend = () =>
    isReady() &&
    inputText().trim().length > 0 &&
    !props.textProcessing.isProcessing();

  async function handleSend() {
    const text = inputText().trim();
    if (!text) return;
    await props.textProcessing.chat(text);
  }

  const resultText = () => {
    const progress = props.textProcessing.inferenceProgress();
    if (progress && !progress.done) {
      return progress.accumulatedText;
    }
    return props.textProcessing.chatResult();
  };

  return (
    <div class="space-y-4">
      {/* Prerequisite warning */}
      <Show when={!isReady()}>
        <div class="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-300">
          <Show when={!props.textProcessing.serverAvailable()}>
            llama-server
          </Show>
          <Show
            when={
              !props.textProcessing.serverAvailable() && !hasDownloadedModel()
            }
          >
            {" / "}
          </Show>
          <Show when={!hasDownloadedModel()}>Model</Show>{" "}
          {t("dev.prerequisiteWarning")}
        </div>
      </Show>

      {/* Input + Send */}
      <div class="flex gap-2">
        <input
          type="text"
          class="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("dev.inputPlaceholder")}
          value={inputText()}
          onInput={(e) => setInputText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend()) handleSend();
          }}
          disabled={!isReady()}
        />
        <Show
          when={!props.textProcessing.isProcessing()}
          fallback={
            <Button
              variant="destructive"
              size="sm"
              class="shrink-0"
              onClick={() => props.textProcessing.cancel()}
            >
              <FiX />
              {t("common.cancel")}
            </Button>
          }
        >
          <Button
            size="sm"
            class="shrink-0"
            onClick={handleSend}
            disabled={!canSend()}
          >
            <FiSend />
            {t("dev.send")}
          </Button>
        </Show>
      </div>

      {/* Result */}
      <Show when={resultText()}>
        <pre class="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm">
          {resultText()}
        </pre>
      </Show>
    </div>
  );
}
