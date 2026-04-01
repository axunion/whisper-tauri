import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";
import { SetupBanner } from "./SetupBanner";

export function Dashboard() {
  return (
    <div class="animate-fade-in m-auto w-full max-w-2xl space-y-5">
      <QuickActions />
      <SetupBanner />
      <RecentActivity />
    </div>
  );
}
