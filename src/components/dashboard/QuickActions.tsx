import { useNavigate } from "@solidjs/router";
import { FiFileText, FiSettings } from "solid-icons/fi";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { useI18n } from "~/i18n";

export function QuickActions() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.quickActions")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-2 gap-3">
          <Button class="w-full" onClick={() => navigate("/transcription")}>
            <FiFileText class="size-4" />
            {t("nav.transcription")}
          </Button>
          <Button
            class="w-full"
            variant="outline"
            onClick={() => navigate("/settings")}
          >
            <FiSettings class="size-4" />
            {t("nav.settings")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
