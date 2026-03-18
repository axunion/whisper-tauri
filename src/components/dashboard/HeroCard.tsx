import { useNavigate } from "@solidjs/router";
import { FiArrowRight, FiMic } from "solid-icons/fi";
import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { useI18n } from "~/i18n";

export function HeroCard() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <Card class="relative overflow-hidden">
      <div class="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 via-transparent to-primary/[0.02]" />
      <CardContent class="relative py-10 text-center">
        <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FiMic class="size-7" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight">
          {t("dashboard.heroTitle")}
        </h2>
        <p class="mt-2 text-sm text-muted-foreground">
          {t("dashboard.heroSubtitle")}
        </p>
        <Button
          size="lg"
          class="mt-6"
          onClick={() => navigate("/transcription")}
        >
          {t("dashboard.heroCta")}
          <FiArrowRight class="ml-1 size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
