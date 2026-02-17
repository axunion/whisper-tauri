import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export function RecentHistory() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent History</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          No transcription history yet.
        </p>
      </CardContent>
    </Card>
  );
}
