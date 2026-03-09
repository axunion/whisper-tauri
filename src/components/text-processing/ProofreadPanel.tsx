import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { FiCheck, FiCopy, FiX } from "solid-icons/fi";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import { toast } from "~/lib/toast";
import type { InferenceProgress } from "~/types";

interface ProofreadPanelProps {
  result: string | null;
  inferenceProgress: InferenceProgress | null;
  isProcessing: boolean;
  onCancel: () => void;
  onReplace?: (text: string) => void;
}

const ProofreadPanel: Component<ProofreadPanelProps> = (props) => {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);

  const displayText = () => {
    if (props.result) return props.result;
    if (props.inferenceProgress) return props.inferenceProgress.accumulatedText;
    return "";
  };

  async function handleCopy() {
    const text = displayText();
    if (!text) return;
    try {
      await writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("result.copiedToast"));
    } catch {
      toast.error(t("result.copyFailedToast"));
    }
  }

  function handleReplace() {
    const text = displayText();
    if (text && props.onReplace) {
      props.onReplace(text);
    }
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">
          {t("textProcessing.proofreadResult")}
        </span>
        <div class="flex items-center gap-2">
          <Show when={props.isProcessing}>
            <Button variant="ghost" size="sm" onClick={props.onCancel}>
              <FiX class="size-4" />
              {t("common.cancel")}
            </Button>
          </Show>
          <Show when={!props.isProcessing && displayText()}>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Show when={copied()} fallback={<FiCopy class="size-4" />}>
                <FiCheck class="size-4" />
              </Show>
              {t("textProcessing.copyResult")}
            </Button>
            <Show when={props.onReplace}>
              <Button variant="outline" size="sm" onClick={handleReplace}>
                {t("textProcessing.replaceText")}
              </Button>
            </Show>
          </Show>
        </div>
      </div>
      <div class="max-h-60 overflow-y-auto rounded-lg border bg-muted/50 p-4">
        <Show
          when={displayText()}
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("textProcessing.proofreading")}
            </p>
          }
        >
          <p class="whitespace-pre-wrap text-sm">{displayText()}</p>
        </Show>
      </div>
    </div>
  );
};

export { ProofreadPanel };
