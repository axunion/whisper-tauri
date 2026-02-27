import { useI18n } from "~/i18n";
import { ModelStatus } from "./ModelStatus";
import { QuickActions } from "./QuickActions";
import { RecentHistory } from "./RecentHistory";

export function Dashboard() {
  const { t } = useI18n();

  return (
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <h1 class="text-2xl font-bold">{t("dashboard.title")}</h1>
      <QuickActions />
      <RecentHistory />
      <ModelStatus />
    </div>
  );
}
