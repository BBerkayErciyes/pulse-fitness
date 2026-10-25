"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const ERRORS: Record<string, string> = {
  no_billing_account: "Ödeme kaydın henüz oluşmamış. Birkaç dakika sonra tekrar dene.",
  billing_not_configured: "Ödeme sistemi şu an kullanılamıyor.",
};

export function ManageBillingButton({ emphasized = false }: { emphasized?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push("/login?next=/dashboard");
        return;
      }
      if (!res.ok || typeof body.url !== "string") {
        setError(ERRORS[body.error] ?? "Üyelik yönetimi açılamadı. Tekrar dene.");
        setPending(false);
        return;
      }
      // Stripe-hosted portal; it sends the member back to /dashboard.
      window.location.assign(body.url);
    } catch {
      setError("Bağlantı hatası. Tekrar dene.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant={emphasized ? "default" : "outline"}
        size="lg"
        className="h-11 w-full sm:w-auto sm:px-5"
        onClick={openPortal}
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : <ExternalLink />}
        {pending ? "Yönlendiriliyor…" : "Üyeliği Yönet"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
