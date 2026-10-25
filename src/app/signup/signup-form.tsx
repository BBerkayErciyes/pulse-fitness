"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, type ComponentProps } from "react";
import { ConsentCheckboxes } from "@/components/consent-checkboxes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/profile/validation";
import { signUp, type SignUpState } from "./actions";

const INITIAL: SignUpState = { status: "idle" };

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  if (state.status === "check-email") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MailCheck className="size-5 text-success" /> E-postanı kontrol et
          </CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Giriş sayfasına dön
          </Link>
        </CardContent>
      </Card>
    );
  }

  // React resets the form after every action; keep what was typed on failure.
  const values = state.values ?? { firstName: "", lastName: "", email: "" };
  const errors = state.errors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Üye ol</CardTitle>
        <CardDescription>Birkaç bilgiyle hesabını oluştur.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="firstName" label="Ad" defaultValue={values.firstName} error={errors.firstName} autoComplete="given-name" maxLength={NAME_MAX_LENGTH} required />
            <Field id="lastName" label="Soyad" defaultValue={values.lastName} error={errors.lastName} autoComplete="family-name" maxLength={NAME_MAX_LENGTH} required />
          </div>
          <Field id="email" label="E-posta" type="email" inputMode="email" defaultValue={values.email} error={errors.email} autoComplete="email" required />
          <Field id="password" label="Şifre" type="password" error={errors.password} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required hint={`En az ${PASSWORD_MIN_LENGTH} karakter.`} />

          <ConsentCheckboxes documents={LEGAL_DOCUMENTS} error={errors.consents} disabled={pending} />

          {state.status === "error" && state.message && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Lütfen bekle…" : "Hesap oluştur"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zaten üye misin?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Giriş yap
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  ...props
}: { id: string; label: string; error?: string; hint?: string } & ComponentProps<"input">) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
