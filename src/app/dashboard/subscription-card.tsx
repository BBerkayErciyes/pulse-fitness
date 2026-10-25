import { AlertTriangle, ArrowRight, CalendarDays, CreditCard, Snowflake } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSubscription, PlanInfo } from "@/lib/subscriptions/dashboard";
import { cn } from "@/lib/utils";
import { FreezeButton, UnfreezeButton } from "./freeze-control";
import { ManageBillingButton } from "./manage-billing-button";

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
  canSelfFreeze = false,
}: {
  subscription: DashboardSubscription | null;
  plan: PlanInfo | null;
  now: number;
  /** Yearly plans include self-service freezing. */
  canSelfFreeze?: boolean;
}) {
  if (!subscription || !plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Üyelik</CardTitle>
          <CardDescription>Henüz bir üyelik paketin yok.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Salona QR ile girebilmek için bir paket seçmen gerekiyor.
          </p>
          <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base sm:w-auto sm:px-6")}>
            Paketleri İncele <ArrowRight />
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, pauseResumesAt } = subscription;
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
              Son ödemen alınamadı. Salona girişin şimdilik açık; kesinti olmaması için aşağıdaki
              &ldquo;Üyeliği Yönet&rdquo; butonundan ödeme yöntemini güncelle.
            </p>
          </div>
        )}

        {status === "paused" && (
          <div className="flex gap-3 rounded-lg bg-muted p-3 text-sm">
            <Snowflake className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-3">
              <p>
                Üyeliğin{" "}
                {pauseResumesAt ? (
                  <>
                    <span className="font-medium">{formatDate(pauseResumesAt)}</span> tarihine kadar
                  </>
                ) : (
                  "şimdilik"
                )}{" "}
                donduruldu. Bu sürede ücret alınmaz ve QR ile giriş yapılamaz.
              </p>
              {canSelfFreeze ? (
                <UnfreezeButton />
              ) : (
                <p className="text-muted-foreground">Dondurmayı kaldırmak için salon görevlisine başvur.</p>
              )}
            </div>
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

        {canSelfFreeze && status === "active" && !cancelAtPeriodEnd && (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Tatile mi çıkıyorsun? Yıllık paketinle üyeliğini dondurabilirsin.</p>
            <FreezeButton />
          </div>
        )}

        {isLive && (
          <div className="border-t pt-4">
            <ManageBillingButton emphasized={status === "past_due"} />
            <p className="mt-2 text-xs text-muted-foreground">
              Kartını güncelle, faturalarını gör veya üyeliğini iptal et.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
