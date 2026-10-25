import { CalendarRange, TrendingUp, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/admin/auth";
import { ACCESS_CHART_DAYS, getDailyAccess, getFinance, type Finance } from "@/lib/admin/analytics";
import { formatMoney } from "@/lib/subscriptions/dashboard";
import { AccessChart } from "./access-chart";

export async function AnalyticsSection() {
  const viewer = await requireStaff();
  // Finance is fetched only for admins; for staff the RPC would refuse anyway.
  const [days, finance] = await Promise.all([getDailyAccess(), viewer.role === "admin" ? getFinance() : null]);

  const totalEntries = days.reduce((sum, d) => sum + d.granted, 0);
  const busiest = days.reduce<(typeof days)[number] | null>((top, d) => (d.granted > (top?.granted ?? 0) ? d : top), null);
  const busiestLabel = busiest
    ? new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${busiest.day}T12:00:00Z`))
    : null;

  return (
    <section aria-labelledby="analytics-heading" className="space-y-4">
      <h2 id="analytics-heading" className="text-lg font-semibold tracking-tight">
        Analitik
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {finance && <FinanceKpis finance={finance} />}
        <Kpi
          label={`Son ${ACCESS_CHART_DAYS} gün giriş`}
          value={totalEntries.toLocaleString("tr-TR")}
          icon={CalendarRange}
          hint={`Günlük ort. ${(totalEntries / days.length).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`}
        />
        <Kpi
          label="En yoğun gün"
          value={busiest ? `${busiest.granted} giriş` : "—"}
          icon={Users}
          hint={busiestLabel ?? "Bu hafta henüz giriş yok"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={finance ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <CardTitle>Günlük turnike girişleri</CardTitle>
            <CardDescription>Son {ACCESS_CHART_DAYS} gün, onaylanan girişler (İstanbul saati)</CardDescription>
          </CardHeader>
          <CardContent>
            <AccessChart days={days} />
          </CardContent>
        </Card>
        {finance && <PlanBreakdown revenue={finance.revenue} />}
      </div>
    </section>
  );
}

function FinanceKpis({ finance }: { finance: Finance }) {
  const { liveSubscribers, pastDue, ending, mrr, unpricedPlans } = finance;
  const subscriberHint = [pastDue > 0 && `${pastDue} ödeme gecikmiş`, ending > 0 && `${ending} dönem sonunda bitecek`]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <Kpi
        label="Aktif abone"
        value={liveSubscribers.toLocaleString("tr-TR")}
        icon={UserCheck}
        hint={subscriberHint || "Salona girişi açık abonelikler"}
      />
      <Kpi
        label="Tahmini aylık gelir"
        value={mrr.length ? mrr.map((m) => formatMoney(m.amount, m.currency)).join(" + ") : "—"}
        icon={TrendingUp}
        hint={
          unpricedPlans > 0 ? `${unpricedPlans} paketin fiyatı okunamadı, hesaba katılmadı` : "Yıllık paketler aylığa bölünerek"
        }
      />
    </>
  );
}

function PlanBreakdown({ revenue }: { revenue: Finance["revenue"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paket dağılımı</CardTitle>
        <CardDescription>Aktif aboneliklerin aylık gelire katkısı</CardDescription>
      </CardHeader>
      <CardContent>
        {revenue.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz aktif abonelik yok.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {revenue.map((p) => (
              <li key={p.planId} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span>
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{p.live} abone</span>
                </span>
                <span className="text-right tabular-nums">
                  {p.monthlyAmount !== null && p.currency ? (
                    <>
                      {formatMoney(Math.round(p.live * p.monthlyAmount), p.currency)}
                      <span className="block text-xs text-muted-foreground">/ ay</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Fiyat yok</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string; icon: LucideIcon; hint: string }) {
  return (
    <Card size="sm" className="gap-2 px-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="size-4" />
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
