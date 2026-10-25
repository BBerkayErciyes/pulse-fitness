import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil Ayarları", robots: { index: false, follow: false } };

export default function ProfilePage() {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <BrandLogo />
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
            <ArrowLeft /> Panele dön
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6 md:py-10">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Profil ayarları</h1>
          <p className="text-sm text-muted-foreground">Kişisel bilgilerini güncel tut.</p>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Kişisel bilgiler</CardTitle>
            <CardDescription>Bu bilgiler yalnızca salon personeli tarafından görülür.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<FormSkeleton />}>
              <Profile />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

async function Profile() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login?next=/dashboard/profile");

  // Scoped to the verified user id (Drizzle bypasses RLS).
  const [profile] = await getDb()
    .select({ firstName: users.firstName, lastName: users.lastName, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId));
  if (!profile) redirect("/dashboard");

  return <ProfileForm email={data.claims.email ?? null} profile={profile} />;
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Yükleniyor">
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="ml-auto h-11 w-48" />
    </div>
  );
}
