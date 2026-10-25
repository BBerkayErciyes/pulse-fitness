"use client";

import { Loader2, Snowflake, Sun } from "lucide-react";
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
import type { ActionResult } from "@/lib/subscriptions/stripe-actions";
import { cn } from "@/lib/utils";
import { freezeMySubscription, unfreezeMySubscription } from "./freeze-actions";

const DURATIONS = [
  { days: 7, label: "1 hafta" },
  { days: 14, label: "2 hafta" },
  { days: 30, label: "30 gün" },
];

/** Freeze button for an active yearly membership. */
export function FreezeButton() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(14);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setResult(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <Snowflake /> Üyeliği dondur
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Üyeliğini dondur</AlertDialogTitle>
          <AlertDialogDescription>
            Dondurma süresince ücret alınmaz ve QR ile giriş yapamazsın. Süre bitince üyeliğin kendiliğinden devam eder;
            istersen daha erken de çözebilirsin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="grid grid-cols-3 gap-2" disabled={pending}>
          <legend className="sr-only">Dondurma süresi</legend>
          {DURATIONS.map((d) => (
            <label
              key={d.days}
              className="flex cursor-pointer items-center justify-center rounded-lg border p-3 text-sm font-medium transition-colors has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="freeze-days"
                className="sr-only"
                checked={days === d.days}
                onChange={() => setDays(d.days)}
              />
              {d.label}
            </label>
          ))}
        </fieldset>
        {result && !result.ok && (
          <p role="alert" className="text-sm text-destructive">
            {result.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const outcome = await freezeMySubscription(days);
                setResult(outcome);
                if (outcome.ok) setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} Dondur
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UnfreezeButton() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await unfreezeMySubscription()))}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sun />} Dondurmayı kaldır
      </Button>
      {result && (
        <p role="status" className={cn("text-sm", result.ok ? "text-success" : "text-destructive")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
