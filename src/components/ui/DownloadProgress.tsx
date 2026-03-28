import { Progress } from "~/components/ui/Progress";

interface DownloadProgressProps {
  progress: number;
  label?: string | undefined;
}

export function DownloadProgress(props: DownloadProgressProps) {
  return (
    <div class="flex h-9 w-28 flex-col justify-center gap-1">
      <Progress value={props.progress} minValue={0} maxValue={100} />
      <p class="text-center text-xs text-muted-foreground">
        {props.label ?? `${Math.round(props.progress)}%`}
      </p>
    </div>
  );
}
