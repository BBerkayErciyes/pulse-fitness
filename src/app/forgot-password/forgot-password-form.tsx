"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm({ linkInvalid = false }: { linkInvalid?: boolean }) {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    linkInvalid ? "Sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste." : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);

    // The email link lands on /auth/confirm, which establishes a recovery
    // session and forwards to /reset-password. This URL must be listed under
    // Supabase → Authentication → URL Configuration → Redirect URLs.
    const redirectTo = `${window.location.origin}/auth/confirm?next=/reset-password`;
    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo });
    setPending(false);

    // Rate limiting is the only error worth surfacing. Anything else (including
    // an unknown address) shows the same confirmation, so the form can't be
    // used to discover which emails have accounts.
    if (error?.status === 429) {
      setError("Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/15">
            <MailCheck className="size-6 text-success" />
          </div>
          <CardTitle className="text-xl">E-postanı kontrol et</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{sentTo}</span> adresine kayıtlı bir hesap varsa,
            şifre sıfırlama bağlantısı gönderdik. Bağlantı kısa bir süre geçerlidir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center text-sm">
          <p className="text-muted-foreground">E-posta gelmediyse gereksiz klasörüne bak.</p>
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setSentTo(null)}
          >
            Başka bir adres dene
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Şifreni sıfırla</CardTitle>
        <CardDescription>Hesabına kayıtlı e-posta adresini gir.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
          </Button>
        </form>
        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Girişe dön
        </Link>
      </CardContent>
    </Card>
  );
}
