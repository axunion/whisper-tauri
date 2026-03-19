import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { FiArrowLeft, FiArrowRight } from "solid-icons/fi";
import { createSignal, Match, onMount, Show, Switch } from "solid-js";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import { createFfmpegDownloader } from "~/primitives/createFfmpegDownloader";
import type { createSettings } from "~/primitives/createSettings";
import { createTextProcessing } from "~/primitives/createTextProcessing";
import { createWhisper } from "~/primitives/createWhisper";
import { CompletionStep } from "./CompletionStep";
import { FfmpegStep } from "./FfmpegStep";
import { LlmStep } from "./LlmStep";
import { ModelStep } from "./ModelStep";
import { OnboardingStepIndicator } from "./OnboardingStepIndicator";
import { WelcomeStep } from "./WelcomeStep";

interface OnboardingProps {
  settings: ReturnType<typeof createSettings>;
}

const TOTAL_STEPS = 5;

async function setCompactWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.setMinSize(new LogicalSize(740, 480));
    await win.setSize(new LogicalSize(740, 480));
    await win.center();
    await win.show();
  } catch {
    // Window resize failed — show at current size
    try {
      await getCurrentWindow().show();
    } catch {
      // ignore
    }
  }
}

async function restoreFullWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.setMinSize(new LogicalSize(800, 600));
    await win.setSize(new LogicalSize(1024, 700));
    await win.center();
  } catch {
    // Window resize failed — continue with current size
  }
}

export function Onboarding(props: OnboardingProps) {
  const { t } = useI18n();
  const [step, setStep] = createSignal(1);
  const [direction, setDirection] = createSignal<"forward" | "back">("forward");

  const whisper = createWhisper();
  const ffmpeg = createFfmpegDownloader();
  const textProcessing = createTextProcessing();

  const hasDownloadedModel = () => whisper.models().some((m) => m.downloaded);

  onMount(() => {
    whisper.loadModels();
    ffmpeg.checkStatus();
    textProcessing.loadModels();
    textProcessing.checkServer();
    setCompactWindow();
  });

  function goNext() {
    if (step() < TOTAL_STEPS) {
      setDirection("forward");
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    if (step() > 1) {
      setDirection("back");
      setStep((s) => s - 1);
    }
  }

  async function handleComplete() {
    await restoreFullWindow();
    await props.settings.completeOnboarding();
  }

  const canGoNext = () => {
    if (step() === 2) return hasDownloadedModel();
    return true;
  };

  const animationClass = () =>
    direction() === "forward"
      ? "animate-slide-in-right"
      : "animate-slide-in-left";

  return (
    <div class="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div class="flex items-center justify-center px-6 pt-5">
        <OnboardingStepIndicator current={step()} total={TOTAL_STEPS} />
      </div>

      {/* Content — keyed Show forces DOM recreation so CSS animation replays */}
      <div class="flex flex-1 flex-col justify-center overflow-y-auto px-8 py-4">
        <Show when={step()} keyed>
          {(_step) => (
            <div class={animationClass()}>
              <Switch>
                <Match when={step() === 1}>
                  <WelcomeStep settings={props.settings} />
                </Match>
                <Match when={step() === 2}>
                  <ModelStep whisper={whisper} />
                </Match>
                <Match when={step() === 3}>
                  <FfmpegStep ffmpeg={ffmpeg} />
                </Match>
                <Match when={step() === 4}>
                  <LlmStep textProcessing={textProcessing} />
                </Match>
                <Match when={step() === 5}>
                  <CompletionStep
                    whisper={whisper}
                    ffmpeg={ffmpeg}
                    textProcessing={textProcessing}
                    onComplete={handleComplete}
                  />
                </Match>
              </Switch>
            </div>
          )}
        </Show>
      </div>

      {/* Navigation */}
      <Show when={step() < TOTAL_STEPS}>
        <div class="flex items-center justify-between px-8 pb-5">
          <Show when={step() > 1} fallback={<div />}>
            <Button variant="ghost" size="sm" onClick={goBack}>
              <FiArrowLeft class="size-4" />
              {t("onboarding.back")}
            </Button>
          </Show>
          <Button size="sm" onClick={goNext} disabled={!canGoNext()}>
            {t("onboarding.next")}
            <FiArrowRight class="size-4" />
          </Button>
        </div>
      </Show>
    </div>
  );
}
