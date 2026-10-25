import { LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMemberDashboard, getPlanInfo } from "@/lib/subscriptions/dashboard";
import { hasAccess } from "@/lib/subscriptions/state-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccessQr } from "./access-qr";
import { signOut } from "./actions";
import { RecentVisits } from "./recent-visits";
import { SubscriptionCard } from "./subscription-card";

export const metadata: Metadata = { title: "Üye Paneli" };

// The header is static and prerenders into the shell; everything that reads the
// session streams in behind <Suspense> (required with cacheComponents).
export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <BrandLogo />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut /> Çıkış
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 md:py-10">
        <Suspense fallback={<DashboardSkeleton />}>
          <MemberDashboard />
        </Suspense>
      </main>
    </div>
  );
}

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Istanbul" }).format(now),
  );
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

const requestTime = () => new Date();

// Not cached on purpose: subscription status must reflect the latest webhook.
async function MemberDashboard() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login?next=/dashboard");

  const { profile, subscription, recentVisits } = await getMemberDashboard(userId);
  const plan = subscription ? await getPlanInfo(subscription.planId) : null;
  const canEnter = subscription !== null && hasAccess(subscription.status);
  const now = requestTime();

  return (
    <>
      <section>
        <p className="text-sm text-muted-foreground">{greeting(now)},</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {profile?.firstName || "Üye"} 👋
        </h1>
      </section>

      <div className="grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-2 md:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Salon Girişi
            </CardTitle>
            <CardDescription>Tek kullanımlık, 30 saniyelik QR kod</CardDescription>
          </CardHeader>
          <CardContent>
            {canEnter ? (
              <AccessQr />
            ) : (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                QR kod oluşturmak için aktif bir üyeliğin olmalı.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <SubscriptionCard subscription={subscription} plan={plan} now={now.getTime()} />
        </div>
        <div className="md:col-span-3">
          <RecentVisits visits={recentVisits} />
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid gap-6 md:grid-cols-5">
        <Skeleton className="h-80 rounded-xl md:col-span-2 md:row-span-2" />
        <Skeleton className="h-56 rounded-xl md:col-span-3" />
        <Skeleton className="h-40 rounded-xl md:col-span-3" />
      </div>
    </div>
  );
}
