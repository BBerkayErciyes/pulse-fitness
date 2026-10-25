"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanKey } from "@/lib/billing/plans";

const ERRORS: Record<string, string> = {
  already_subscribed: "Zaten aktif bir üyeliğin var.",
  billing_not_configured: "Ödeme sistemi şu an kullanılamıyor.",
};

export function CheckoutButton({
  plan,
  highlighted,
  disabled,
}: {
  plan: PlanKey;
  highlighted: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.url !== "string") {
        setError(ERRORS[body.error] ?? "Ödeme sayfası açılamadı. Tekrar dene.");
        setPending(false);
        return;
      }
      // Full navigation to Stripe-hosted Checkout; keep the spinner until it loads.
      window.location.assign(body.url);
    } catch {
      setError("Bağlantı hatası. Tekrar dene.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        variant={highlighted ? "default" : "outline"}
        className="h-12 w-full text-base"
        onClick={startCheckout}
        disabled={pending || disabled}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Yönlendiriliyor…" : "Hemen Başla"}
        {!pending && <ArrowRight />}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}{" "}
          {error === ERRORS.already_subscribed && (
            <Link href="/dashboard" className="font-medium underline underline-offset-4">
              Panele git
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
