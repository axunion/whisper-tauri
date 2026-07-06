import { Progress } from "~/components/ui/Progress";
import { cn } from "~/lib/utils";

interface DownloadProgressProps {
  progress: number;
  label?: string | undefined;
  class?: string | undefined;
}

export function DownloadProgress(props: DownloadProgressProps) {
  return (
    <div class={cn("flex h-9 w-28 flex-col justify-center gap-1", props.class)}>
      <Progress value={props.progress} minValue={0} maxValue={100} />
      <p class="text-center text-xs text-muted-foreground">
        {props.label ?? `${Math.round(props.progress)}%`}
      </p>
    </div>
  );
}
