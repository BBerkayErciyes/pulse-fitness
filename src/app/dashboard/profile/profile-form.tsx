"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NAME_MAX_LENGTH } from "@/lib/profile/validation";
import { updateProfile, type ProfileFormState } from "./actions";

const INITIAL_STATE: ProfileFormState = { status: "idle" };

export function ProfileForm({
  email,
  profile,
}: {
  email: string | null;
  profile: { firstName: string; lastName: string; phone: string | null };
}) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL_STATE);
  // React resets the form after every action; keep what was typed on failure.
  const values = state.status === "error" && state.values ? state.values : { ...profile, phone: profile.phone ?? "" };

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="firstName"
          label="Ad"
          defaultValue={values.firstName}
          error={state.errors?.firstName}
          autoComplete="given-name"
          maxLength={NAME_MAX_LENGTH}
          required
        />
        <Field
          id="lastName"
          label="Soyad"
          defaultValue={values.lastName}
          error={state.errors?.lastName}
          autoComplete="family-name"
          maxLength={NAME_MAX_LENGTH}
          required
        />
      </div>
      <Field
        id="phone"
        label="Telefon"
        type="tel"
        inputMode="tel"
        defaultValue={values.phone}
        error={state.errors?.phone}
        autoComplete="tel"
        placeholder="0555 123 45 67"
        hint="İsteğe bağlı. Üyeliğinle ilgili acil durumlarda ulaşabilmemiz için."
      />
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" value={email ?? ""} disabled readOnly className="h-10" />
        <p className="text-xs text-muted-foreground">E-posta adresin giriş bilgin olduğu için buradan değiştirilemez.</p>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p role="status" aria-live="polite" className="text-sm sm:mr-auto">
          {state.status === "success" && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <CheckCircle2 className="size-4" /> {state.message}
            </span>
          )}
          {state.status === "error" && <span className="text-destructive">{state.message}</span>}
        </p>
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </Button>
      </div>
    </form>
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
      <Input id={id} name={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className="h-10" {...props} />
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
