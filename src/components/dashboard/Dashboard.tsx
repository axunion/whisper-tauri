import { HeroCard } from "./HeroCard";
import { RecentActivity } from "./RecentActivity";
import { StatsRow } from "./StatsRow";

export function Dashboard() {
  return (
    <div class="animate-fade-in mx-auto w-full max-w-2xl space-y-5">
      <HeroCard />
      <StatsRow />
      <RecentActivity />
    </div>
  );
}
