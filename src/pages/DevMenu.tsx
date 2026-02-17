import { Show } from "solid-js";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export default function DevMenu() {
  return (
    <Show
      when={import.meta.env.DEV}
      fallback={
        <div class="mx-auto w-full max-w-3xl">
          <p class="text-muted-foreground">
            This page is only available in development mode.
          </p>
        </div>
      }
    >
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <h1 class="text-2xl font-bold">Dev Menu</h1>
        <Card>
          <CardHeader>
            <CardTitle>Developer Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">Coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </Show>
  );
}
