"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));

    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setPending(true);
    setError(null);
    // Works only with the recovery session created by /auth/confirm.
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
    if (error) {
      setPending(false);
      if (error.name === "AuthSessionMissingError" || error.status === 401) {
        setSessionMissing(true);
      } else if (error.code === "same_password") {
        setError("Yeni şifren eskisinden farklı olmalı.");
      } else if (error.code === "weak_password") {
        setError("Bu şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seç.");
      } else {
        setError("Şifre güncellenemedi. Tekrar dene.");
      }
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (sessionMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Bağlantının süresi dolmuş</CardTitle>
          <CardDescription>
            Şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
            Yeni bağlantı gönder
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Yeni şifre belirle</CardTitle>
        <CardDescription>En az {MIN_LENGTH} karakter kullan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Yeni şifre</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_LENGTH} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Yeni şifre (tekrar)</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_LENGTH} required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Şifreyi güncelle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
