"use client";

import { QrCode, RefreshCw, TimerOff } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCESS_REASON_LABELS } from "@/lib/subscriptions/labels";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "showing"; token: string; deadline: number; ttlMs: number }
  | { kind: "expired" }
  | { kind: "error"; message: string; signedOut?: boolean };

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function AccessQr() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [now, setNow] = useState(0);

  // Tick while a QR is on screen; flip to "expired" once the deadline passes.
  useEffect(() => {
    if (state.kind !== "showing") return;
    const { deadline } = state;
    const id = setInterval(() => {
      const current = Date.now();
      if (current >= deadline) setState({ kind: "expired" });
      else setNow(current);
    }, 200);
    return () => clearInterval(id);
  }, [state]);

  async function generate() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/access/generate", { method: "POST", cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setState({ kind: "error", message: "Oturumunun süresi doldu.", signedOut: true });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: ACCESS_REASON_LABELS[body.error] ?? "QR kod oluşturulamadı." });
        return;
      }
      // Countdown is anchored to the response arrival, not the server's
      // absolute expiresAt, so a skewed phone clock can't distort it.
      const ttlMs = body.expiresIn * 1000;
      const receivedAt = Date.now();
      setNow(receivedAt);
      setState({ kind: "showing", token: body.token, deadline: receivedAt + ttlMs, ttlMs });
    } catch {
      setState({ kind: "error", message: "Bağlantı hatası. Tekrar dene." });
    }
  }

  if (state.kind === "showing") {
    const remainingMs = Math.max(0, state.deadline - now);
    const seconds = Math.ceil(remainingMs / 1000);
    const fraction = remainingMs / state.ttlMs;
    const tone = seconds <= 5 ? "text-destructive" : seconds <= 10 ? "text-warning" : "text-primary";

    return (
      <div className="flex flex-col items-center gap-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <QRCodeSVG
            value={state.token}
            size={232}
            level="M"
            marginSize={1}
            className="h-auto w-full max-w-[232px]"
            aria-label="Giriş QR kodu"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className={cn("relative size-16", tone)}>
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={RING_RADIUS} className="fill-none stroke-muted" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                className="fill-none stroke-current transition-[stroke-dashoffset] duration-200 ease-linear"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center font-mono text-xl font-semibold tabular-nums">
              {seconds}
            </span>
          </div>
          <div className="text-sm">
            <p className="font-medium">Turnikeye okut</p>
            <p className="text-muted-foreground">{seconds} saniye geçerli · tek kullanımlık</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
        <div className="grid size-16 place-items-center rounded-full bg-muted">
          <TimerOff className="size-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Güvenliğin için QR kodlar 30 saniye geçerlidir.</p>
        <Button size="lg" className="h-12 w-full text-base" onClick={generate}>
          <RefreshCw /> Süresi Doldu - Yeni QR Üret
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-primary/10">
        <QrCode className="size-8 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">
        Turnikeye yaklaştığında QR kodunu oluştur. Kod 30 saniye geçerlidir.
      </p>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}{" "}
          {state.signedOut && (
            <Link href="/login" className="font-medium underline underline-offset-4">
              Tekrar giriş yap
            </Link>
          )}
        </p>
      )}
      <Button
        size="lg"
        className="h-12 w-full text-base"
        onClick={generate}
        disabled={state.kind === "loading"}
      >
        <QrCode /> {state.kind === "loading" ? "Oluşturuluyor…" : "Giriş İçin QR Üret"}
      </Button>
    </div>
  );
}
