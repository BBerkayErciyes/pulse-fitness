import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMissingConsents } from "@/lib/legal/consents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Yasal Onaylar", robots: { index: false, follow: false } };

export default function ConsentsPage() {
  return (
    <AuthShell subtitle="Devam etmeden önce birkaç onaya ihtiyacımız var.">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Yasal onaylar</CardTitle>
          <CardDescription>
            Üyeliğini kullanabilmen için aşağıdaki metinleri okuyup onaylaman gerekiyor. Metinler güncellendiğinde yeniden
            sorulur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <MissingConsents />
          </Suspense>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

async function MissingConsents() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login?next=/dashboard/consents");

  const missing = await getMissingConsents(userId);
  if (missing.length === 0) redirect("/dashboard");
  return <ConsentForm documentIds={missing.map((d) => d.id)} />;
}
