import { FiSend, FiX } from "solid-icons/fi";
import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import type { createTextProcessing } from "~/primitives/createTextProcessing";

interface LlmTesterProps {
  textProcessing: ReturnType<typeof createTextProcessing>;
}

export function LlmTester(props: LlmTesterProps) {
  const { t } = useI18n();
  const [inputText, setInputText] = createSignal(t("dev.defaultInput"));

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
          <Show when={!hasDownloadedModel()}>{t("transcription.model")}</Show>{" "}
          {t("dev.prerequisiteWarning")}
        </div>
      </Show>

      <div class="space-y-2">
        <textarea
          class="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
          placeholder={t("dev.defaultInput")}
          onFocus={(e) => e.currentTarget.select()}
          value={inputText()}
          onInput={(e) => setInputText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend()) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={!isReady()}
        />
        <div class="flex justify-end">
          <Show
            when={!props.textProcessing.isProcessing()}
            fallback={
              <Button
                variant="destructive"
                size="sm"
                class="w-28"
                onClick={() => props.textProcessing.cancel()}
              >
                <FiX />
                {t("common.cancel")}
              </Button>
            }
          >
            <Button
              size="sm"
              class="w-28"
              onClick={handleSend}
              disabled={!canSend()}
            >
              <FiSend />
              {t("dev.send")}
            </Button>
          </Show>
        </div>
      </div>

      <Show when={props.textProcessing.error()}>
        {(err) => (
          <div class="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{t(err().messageKey)}</span>
            <button
              type="button"
              class="ml-2 text-destructive/60 hover:text-destructive"
              onClick={() => props.textProcessing.clearError()}
            >
              <FiX class="size-3.5" />
            </button>
          </div>
        )}
      </Show>

      <Show when={resultText()}>
        <pre class="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm">
          {resultText()}
        </pre>
      </Show>
    </div>
  );
}
