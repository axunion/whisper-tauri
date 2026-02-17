import { useNavigate } from "@solidjs/router";
import { FiFileText, FiSettings } from "solid-icons/fi";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/transcription")}>
            <FiFileText class="size-4" />
            Transcription
          </Button>
          <Button variant="outline" onClick={() => navigate("/settings")}>
            <FiSettings class="size-4" />
            Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
