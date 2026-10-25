"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    setPending(true);
    setError(null);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("E-posta veya şifre hatalı.");
        setPending(false);
        return;
      }
      router.replace(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the handle_new_user trigger to fill public.users.
      options: {
        data: { first_name: String(form.get("firstName")), last_name: String(form.get("lastName")) },
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
    } else {
      setNotice("Kaydın alındı. Hesabını doğrulamak için e-postanı kontrol et.");
      setMode("sign-in");
    }
  }

  const isSignUp = mode === "sign-up";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{isSignUp ? "Üye ol" : "Tekrar hoş geldin"}</CardTitle>
        <CardDescription>
          {isSignUp ? "Birkaç bilgiyle hesabını oluştur." : "Hesabına giriş yap."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Ad</Label>
                <Input id="firstName" name="firstName" autoComplete="given-name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Soyad</Label>
                <Input id="lastName" name="lastName" autoComplete="family-name" required />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Şifre</Label>
              {!isSignUp && (
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  Şifremi Unuttum
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? 8 : undefined}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-success">
              {notice}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Lütfen bekle…" : isSignUp ? "Hesap oluştur" : "Giriş yap"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Zaten üye misin?" : "Hesabın yok mu?"}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setMode(isSignUp ? "sign-in" : "sign-up");
              setError(null);
            }}
          >
            {isSignUp ? "Giriş yap" : "Üye ol"}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
