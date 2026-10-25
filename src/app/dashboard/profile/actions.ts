"use server";

import { refresh } from "next/cache";
import { parseProfileInput, type ProfileField } from "@/lib/profile/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<ProfileField, string>>;
  /** What the member typed, so a failed submit does not wipe the form. */
  values?: { firstName: string; lastName: string; phone: string };
};

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    return { status: "error", message: "Oturumun sona ermiş. Lütfen tekrar giriş yap.", values: raw };
  }

  const parsed = parseProfileInput(raw);
  if (!parsed.ok) {
    return { status: "error", message: "Lütfen işaretli alanları düzelt.", errors: parsed.errors, values: raw };
  }

  // Written with the member's own JWT on purpose: RLS (users_update_own) and
  // the column grant limit this to their row and to these three columns, so
  // nothing here can touch role or billing fields.
  const { data: updated, error } = await supabase
    .from("users")
    .update({ first_name: parsed.values.firstName, last_name: parsed.values.lastName, phone: parsed.values.phone })
    .eq("id", userId)
    .select("id");
  if (error || updated.length !== 1) {
    console.error("[profile] update failed:", error ?? "no row updated");
    return { status: "error", message: "Bilgilerin kaydedilemedi. Tekrar dene.", values: raw };
  }

  refresh();
  return { status: "success", message: "Bilgilerin güncellendi." };
}
