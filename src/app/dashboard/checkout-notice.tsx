"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 2500;
const MAX_POLLS = 12;

/**
 * After Stripe redirects back, the webhook may not have created the
 * subscription yet. Re-render the server component until it shows up.
 */
export function AwaitingActivation() {
  const router = useRouter();
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (polls >= MAX_POLLS) return;
    const id = setTimeout(() => {
      router.refresh();
      setPolls((n) => n + 1);
    }, POLL_MS);
    return () => clearTimeout(id);
  }, [polls, router]);

  const gaveUp = polls >= MAX_POLLS;
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl bg-primary/10 p-4 text-sm">
      {gaveUp ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      )}
      <p>
        <span className="font-medium">Ödemen alındı.</span>{" "}
        {gaveUp
          ? "Üyeliğin birkaç dakika içinde aktifleşecek; sayfayı birazdan yenileyebilirsin."
          : "Üyeliğin aktifleştiriliyor, birkaç saniye sürebilir…"}
      </p>
    </div>
  );
}
