import type { Component } from "solid-js";

interface ResultTextTabProps {
  text: string;
}

const ResultTextTab: Component<ResultTextTabProps> = (props) => {
  return (
    <div class="h-full overflow-y-auto rounded-lg border bg-muted/50 p-4">
      <p class="whitespace-pre-wrap text-sm">{props.text}</p>
    </div>
  );
};

export { ResultTextTab };
