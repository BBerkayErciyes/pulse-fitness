import { Check, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_KEYS, PLANS, priceIdFor, type PlanDefinition } from "@/lib/billing/plans";
import { getCachedPlanInfo } from "@/lib/billing/prices";
import { formatMoney } from "@/lib/subscriptions/dashboard";
import { cn } from "@/lib/utils";
import { CheckoutButton } from "./checkout-button";

export const metadata: Metadata = {
  title: "Paketler",
  description: "Pulse Fitness aylık ve yıllık üyelik paketleri.",
};

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-primary/10 via-background to-background">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" aria-label="Pulse Fitness ana sayfa">
          <BrandLogo />
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Panelim
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 md:py-16">
        <section className="mx-auto max-w-xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Sana uygun paketi seç</h1>
          <p className="mt-3 text-muted-foreground">
            Tüm paketlerde sınırsız giriş ve QR ile temassız turnike. Gizli ücret yok.
          </p>
        </section>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {PLAN_KEYS.map((key) => (
            <PlanCard key={key} plan={PLANS[key]} />
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <ShieldCheck className="mr-1.5 inline size-4 align-[-3px]" />
          Ödemeler Stripe altyapısıyla güvenle alınır. İstediğin zaman iptal edebilirsin.
        </p>
      </main>
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanDefinition }) {
  return (
    <Card
      className={cn(
        "relative",
        plan.highlighted && "ring-2 ring-primary shadow-lg shadow-primary/10 md:-translate-y-2",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl">{plan.title}</CardTitle>
          {plan.highlighted && <Badge>En popüler</Badge>}
        </div>
        <CardDescription>{plan.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-6">
        {/* Prices come from Stripe (cached); the rest of the card is static. */}
        <Suspense fallback={<Skeleton className="h-14 w-40" />}>
          <PlanPrice plan={plan} />
        </Suspense>
        <ul className="space-y-2.5 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pb-4">
        <div className="w-full">
          <Suspense fallback={<Skeleton className="h-12 w-full rounded-lg" />}>
            <PlanAction plan={plan} />
          </Suspense>
        </div>
      </CardFooter>
    </Card>
  );
}

async function PlanPrice({ plan }: { plan: PlanDefinition }) {
  const priceId = priceIdFor(plan.key);
  const info = priceId ? await getCachedPlanInfo(priceId) : null;

  if (!info?.found || info.unitAmount === null || !info.currency) {
    return <p className="text-2xl font-semibold text-muted-foreground">Yakında</p>;
  }

  const perLabel = info.interval === "year" ? "yıl" : info.interval === "month" ? "ay" : info.interval;
  let detail: string | null = null;
  let savings: number | null = null;

  if (info.interval === "year") {
    detail = `Ayda yalnızca ${formatMoney(Math.round(info.unitAmount / 12), info.currency)}`;
    const monthlyId = priceIdFor("monthly");
    const monthly = monthlyId ? await getCachedPlanInfo(monthlyId) : null;
    if (monthly?.unitAmount && monthly.currency === info.currency && monthly.interval === "month") {
      const pct = Math.round((1 - info.unitAmount / (monthly.unitAmount * 12)) * 100);
      if (pct > 0) savings = pct;
    }
  }

  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{formatMoney(info.unitAmount, info.currency)}</span>
        {perLabel && <span className="text-muted-foreground">/ {perLabel}</span>}
      </p>
      {(detail || savings) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {detail}
          {savings && <Badge className="bg-success/15 text-success">%{savings} tasarruf</Badge>}
        </p>
      )}
    </div>
  );
}

async function PlanAction({ plan }: { plan: PlanDefinition }) {
  const priceId = priceIdFor(plan.key);
  const info = priceId ? await getCachedPlanInfo(priceId) : null;
  return <CheckoutButton plan={plan.key} highlighted={plan.highlighted} disabled={!info?.found} />;
}
