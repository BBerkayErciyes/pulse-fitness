import { ArrowRight, Info, LogOut, PartyPopper, Settings, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMemberDashboard, getPlanInfo } from "@/lib/subscriptions/dashboard";
import { getMissingConsents } from "@/lib/legal/consents";
import { planAllowsSelfFreeze } from "@/lib/subscriptions/freeze";
import { hasAccess } from "@/lib/subscriptions/state-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AccessQr } from "./access-qr";
import { signOut } from "./actions";
import { AwaitingActivation } from "./checkout-notice";
import { RecentVisits } from "./recent-visits";
import { SubscriptionCard } from "./subscription-card";

export const metadata: Metadata = { title: "Üye Paneli", robots: { index: false, follow: false } };

// The header is static and prerenders into the shell; everything that reads the
// session streams in behind <Suspense> (required with cacheComponents).
export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <BrandLogo />
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard/profile"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
            >
              <UserRound /> Profil
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut /> Çıkış
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 md:py-10">
        <Suspense fallback={<DashboardSkeleton />}>
          <MemberDashboard searchParams={searchParams} />
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
async function MemberDashboard({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  // Per-request by nature; also keeps getClaims()' expiry check and the
  // greeting clock (Date.now) out of prerendering.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login?next=/dashboard");

  const [{ profile, subscription, recentVisits }, { success, canceled }, missingConsents] = await Promise.all([
    getMemberDashboard(userId),
    searchParams,
    getMissingConsents(userId),
  ]);
  // Accounts without the current legal consents (created before Phase 12, or
  // outside /signup) accept them before using the panel.
  if (missingConsents.length > 0) redirect("/dashboard/consents");
  const plan = subscription ? await getPlanInfo(subscription.planId) : null;
  const canEnter = subscription !== null && hasAccess(subscription.status);
  const now = requestTime();

  return (
    <>
      {success === "true" &&
        (canEnter ? (
          <div role="status" className="flex items-start gap-3 rounded-xl bg-success/15 p-4 text-sm">
            <PartyPopper className="mt-0.5 size-4 shrink-0 text-success" />
            <p>
              <span className="font-medium">Aramıza hoş geldin!</span> Üyeliğin aktif, QR kodunla hemen
              salona girebilirsin.
            </p>
          </div>
        ) : (
          <AwaitingActivation />
        ))}
      {canceled === "true" && !canEnter && (
        <div role="status" className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>
            Ödeme tamamlanmadı, kartından ücret alınmadı.{" "}
            <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
              Paketlere tekrar göz at
            </Link>
          </p>
        </div>
      )}

      <section className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting(now)},</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {profile?.firstName || "Üye"} 👋
          </h1>
        </div>
        {(profile?.role === "admin" || profile?.role === "staff") && (
          <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Settings /> {profile.role === "admin" ? "Yönetim paneli" : "Personel paneli"}
          </Link>
        )}
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
              <div className="space-y-4">
                <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  QR kod oluşturmak için aktif bir üyeliğin olmalı.
                </p>
                {/* No-subscription users get the CTA in the subscription card instead. */}
                {subscription?.status === "canceled" && (
                  <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
                    Paketleri incele <ArrowRight />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <SubscriptionCard
            subscription={subscription}
            plan={plan}
            now={now.getTime()}
            canSelfFreeze={plan !== null && planAllowsSelfFreeze(plan)}
          />
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
