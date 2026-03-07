import { ModelStatus } from "./ModelStatus";
import { QuickActions } from "./QuickActions";
import { RecentHistory } from "./RecentHistory";

export function Dashboard() {
  return (
    <div class="animate-fade-in mx-auto w-full max-w-3xl space-y-6">
      <QuickActions />
      <RecentHistory />
      <ModelStatus />
    </div>
  );
}
