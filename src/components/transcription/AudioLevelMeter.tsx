import type { Component } from "solid-js";
import { cn } from "~/lib/utils";

interface AudioLevelMeterProps {
  level: number;
  peakLevel: number;
  class?: string;
}

const AudioLevelMeter: Component<AudioLevelMeterProps> = (props) => {
  const scaledLevel = () => Math.min(props.level * 3, 1);
  const scaledPeak = () => Math.min(props.peakLevel * 2, 1);

  return (
    <div class={cn("flex flex-col gap-1.5", props.class)}>
      <div class="relative h-3 w-full overflow-hidden rounded-full bg-muted/50 backdrop-blur-sm">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-75"
          style={{ width: `${scaledLevel() * 100}%` }}
        />
        <div
          class="absolute inset-y-0 w-0.5 bg-violet-300 transition-all duration-150"
          style={{ left: `${scaledPeak() * 100}%` }}
        />
      </div>
    </div>
  );
};

export { AudioLevelMeter };
