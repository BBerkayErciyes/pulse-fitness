"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { evidenceFromHeaders, recordConsents } from "@/lib/legal/consents";
import { consentFieldName, LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { parseProfileInput, PASSWORD_MIN_LENGTH } from "@/lib/profile/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignUpState = {
  status: "idle" | "error" | "check-email";
  message?: string;
  errors?: Partial<Record<"firstName" | "lastName" | "email" | "password" | "consents", string>>;
  values?: { firstName: string; lastName: string; email: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign-up runs on the server so the legal consents are checked and stored
 * here, not in the browser. Accounts created any other way (e.g. directly
 * against the Supabase API) have no consents and are sent to
 * /dashboard/consents before they can get a QR code or check out.
 */
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const values = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
  };
  const password = String(formData.get("password") ?? "");

  const errors: SignUpState["errors"] = {};
  const names = parseProfileInput({ firstName: values.firstName, lastName: values.lastName, phone: "" });
  if (!names.ok) Object.assign(errors, { firstName: names.errors.firstName, lastName: names.errors.lastName });
  if (!EMAIL_RE.test(values.email)) errors.email = "Geçerli bir e-posta adresi gir.";
  if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;
  if (LEGAL_DOCUMENTS.some((d) => formData.get(consentFieldName(d.id)) !== "on")) {
    errors.consents = "Devam etmek için tüm metinleri onaylaman gerekiyor.";
  }
  const firstError = Object.values(errors).find(Boolean);
  if (firstError || !names.ok) {
    return { status: "error", message: "Lütfen işaretli alanları kontrol et.", errors, values };
  }

  const requestHeaders = await headers();
  const origin =
    process.env.APP_URL?.replace(/\/$/, "") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host")}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: {
      // Read by the handle_new_user trigger to fill public.users.
      data: { first_name: names.values.firstName, last_name: names.values.lastName },
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    const message =
      error.code === "user_already_exists"
        ? "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene."
        : error.code === "weak_password"
        ? "Bu şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seç."
        : error.code === "over_email_send_rate_limit" || error.status === 429
          ? "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene."
          : "Kayıt şu an tamamlanamadı. Tekrar dene.";
    if (!["user_already_exists", "weak_password", "over_email_send_rate_limit"].includes(error.code ?? "")) {
      console.error("[signup] signUp failed:", error.code, error.message);
    }
    return { status: "error", message, values };
  }

  // With e-mail confirmation on, an already registered address returns an
  // obfuscated user without identities. Answer exactly as for a new sign-up
  // so the form cannot be used to discover who is a member.
  const isNewUser = Boolean(data.user && (data.user.identities?.length ?? 0) > 0);
  if (isNewUser && data.user) {
    // The profile row exists already: the signup trigger runs in the same
    // transaction that created the auth user.
    await recordConsents(data.user.id, LEGAL_DOCUMENTS, evidenceFromHeaders(requestHeaders));
  }

  if (data.session) redirect("/dashboard");
  return {
    status: "check-email",
    message: "Kaydın alındı. Hesabını doğrulamak için e-postanı kontrol et.",
  };
}
