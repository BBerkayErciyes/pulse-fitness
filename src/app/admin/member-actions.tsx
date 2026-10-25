"use client";

import { Ban, Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cancelMemberSubscription,
  resumeMemberSubscription,
  type AdminActionResult,
  type CancelMode,
} from "./actions";

const MODES: { value: CancelMode; title: string; description: string }[] = [
  {
    value: "period_end",
    title: "Dönem sonunda iptal et",
    description: "Üye ödediği dönemin sonuna kadar salona girebilir, sonra yenilenmez.",
  },
  {
    value: "now",
    title: "Hemen iptal et",
    description: "Erişim hemen kapanır. Kalan süre için otomatik iade yapılmaz.",
  },
];

export function MemberActions({
  subscriptionId,
  memberName,
  cancelAtPeriodEnd,
}: {
  subscriptionId: string;
  memberName: string;
  cancelAtPeriodEnd: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CancelMode>(cancelAtPeriodEnd ? "now" : "period_end");
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<AdminActionResult>, closeOnSuccess: boolean) =>
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok && closeOnSuccess) setOpen(false);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1">
        {cancelAtPeriodEnd && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => resumeMemberSubscription(subscriptionId), false)}
            title="Planlanmış iptali geri al"
          >
            {pending && !open ? <Loader2 className="animate-spin" /> : <Undo2 />}
            <span className="sr-only lg:not-sr-only">Geri al</span>
          </Button>
        )}
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (pending) return;
            setOpen(next);
            if (next) {
              setResult(null);
              setMode(cancelAtPeriodEnd ? "now" : "period_end");
            }
          }}
        >
          <AlertDialogTrigger
            render={
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Aboneliği iptal et" />
            }
          >
            <Ban /> <span className="sr-only lg:not-sr-only">İptal</span>
          </AlertDialogTrigger>
          <AlertDialogContent className="data-[size=default]:sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Abonelik iptali</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{memberName}</span> adlı üyenin aboneliği Stripe
                üzerinden iptal edilecek. Bu işlem geri alınamaz; üye yeniden abone olmak zorunda kalır.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <fieldset className="space-y-2" disabled={pending}>
              <legend className="sr-only">İptal türü</legend>
              {MODES.map((m) => {
                const unavailable = m.value === "period_end" && cancelAtPeriodEnd;
                return (
                  <label
                    key={m.value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors has-checked:border-primary has-checked:bg-primary/5",
                      unavailable && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="cancel-mode"
                      value={m.value}
                      checked={mode === m.value}
                      disabled={unavailable}
                      onChange={() => setMode(m.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">{m.title}</span>
                      <span className="text-muted-foreground">
                        {unavailable ? "Zaten dönem sonunda bitecek şekilde ayarlı." : m.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {result && !result.ok && (
              <p role="alert" className="text-sm text-destructive">
                {result.message}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => run(() => cancelMemberSubscription(subscriptionId, mode), true)}
              >
                {pending && <Loader2 className="animate-spin" />}
                {mode === "now" ? "Hemen iptal et" : "Dönem sonunda iptal et"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {result && !open && (
        <p role="status" className={cn("text-xs", result.ok ? "text-success" : "text-destructive")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
