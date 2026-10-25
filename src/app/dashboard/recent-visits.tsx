import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberDashboard } from "@/lib/subscriptions/dashboard";
import { ACCESS_REASON_LABELS } from "@/lib/subscriptions/labels";

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(date);

export function RecentVisits({ visits }: { visits: MemberDashboard["recentVisits"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Son girişler</CardTitle>
        <CardDescription>Turnike okutmaların</CardDescription>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz bir giriş kaydın yok.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visits.map((visit) => (
              <li key={visit.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                {visit.granted ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Giriş yapıldı" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-destructive" aria-label="Reddedildi" />
                )}
                <span className="flex-1">
                  {visit.granted
                    ? visit.reason === "manual_bypass"
                      ? "Görevli tarafından giriş"
                      : "Giriş yapıldı"
                    : (visit.reason && ACCESS_REASON_LABELS[visit.reason]) ?? "Reddedildi"}
                </span>
                <time className="text-xs text-muted-foreground tabular-nums" dateTime={visit.createdAt.toISOString()}>
                  {formatDateTime(visit.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
