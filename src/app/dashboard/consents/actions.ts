"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { evidenceFromHeaders, getMissingConsents, recordConsents } from "@/lib/legal/consents";
import { consentFieldName } from "@/lib/legal/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConsentFormState = { error?: string };

export async function acceptConsents(_prev: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login?next=/dashboard/consents");

  // Only the documents still missing for this user, at their current version.
  const missing = await getMissingConsents(userId);
  if (missing.some((d) => formData.get(consentFieldName(d.id)) !== "on")) {
    return { error: "Devam etmek için tüm metinleri onaylaman gerekiyor." };
  }
  await recordConsents(userId, missing, evidenceFromHeaders(await headers()));
  redirect("/dashboard");
}
