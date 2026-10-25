import { AlertTriangle, CalendarDays, CreditCard } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSubscription, PlanInfo } from "@/lib/subscriptions/dashboard";
import { StatusBadge } from "./status-badge";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(date);

function periodProgress(start: Date, end: Date, now: number) {
  const total = end.getTime() - start.getTime();
  const elapsed = Math.min(Math.max(now - start.getTime(), 0), total);
  return {
    percent: Math.round((elapsed / total) * 100),
    daysLeft: Math.max(0, Math.ceil((end.getTime() - now) / DAY_MS)),
  };
}

export function SubscriptionCard({
  subscription,
  plan,
  now,
}: {
  subscription: DashboardSubscription | null;
  plan: PlanInfo | null;
  now: number;
}) {
  if (!subscription || !plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Üyelik</CardTitle>
          <CardDescription>Henüz bir üyelik paketin yok.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Salona QR ile girebilmek için bir paket seçmen gerekiyor.
        </CardContent>
      </Card>
    );
  }

  const { status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd } = subscription;
  const { percent, daysLeft } = periodProgress(currentPeriodStart, currentPeriodEnd, now);
  const isLive = status !== "canceled";

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <CreditCard className="size-3.5" /> Üyelik paketi
        </CardDescription>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        {plan.price && <p className="text-sm text-muted-foreground">{plan.price}</p>}
        <CardAction>
          <StatusBadge status={status} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {status === "past_due" && (
          <div className="flex gap-3 rounded-lg bg-warning/15 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              Son ödemen alınamadı. Salona girişin şimdilik açık; kesinti olmaması için ödeme
              yöntemini güncelle.
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> Dönem başlangıcı
            </dt>
            <dd className="mt-1 font-medium">{formatDate(currentPeriodStart)}</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> {isLive && !cancelAtPeriodEnd ? "Yenilenme" : "Bitiş"}
            </dt>
            <dd className="mt-1 font-medium">{formatDate(currentPeriodEnd)}</dd>
          </div>
        </dl>

        {isLive && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Dönem ilerlemesi</span>
              <span>{daysLeft} gün kaldı</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Dönem ilerlemesi"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {cancelAtPeriodEnd && isLive && (
          <p className="text-sm text-muted-foreground">
            Üyeliğin {formatDate(currentPeriodEnd)} tarihinde sona erecek ve yenilenmeyecek.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
