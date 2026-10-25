"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ next, linkInvalid = false }: { next: string; linkInvalid?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkInvalid ? "Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Giriş yapmayı dene." : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    setPending(true);
    setError(null);
    const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-posta veya şifre hatalı.");
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tekrar hoş geldin</CardTitle>
        <CardDescription>Hesabına giriş yap.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Şifre</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                Şifremi Unuttum
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Lütfen bekle…" : "Giriş yap"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Hesabın yok mu?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Üye ol
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
