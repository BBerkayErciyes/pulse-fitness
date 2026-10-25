"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { getPlanInfo } from "@/lib/subscriptions/dashboard";
import {
  daysFromNow,
  freezeBlocker,
  freezeInStripe,
  isFreezeDays,
  planAllowsSelfFreeze,
  unfreezeInStripe,
} from "@/lib/subscriptions/freeze";
import type { ActionResult } from "@/lib/subscriptions/stripe-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The member's own live subscription, looked up from the verified session —
// the client never names a subscription, so nobody can freeze someone else's.
async function ownLiveSubscription() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  const [row] = await getDb()
    .select({
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      status: subscriptions.status,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      planId: subscriptions.planId,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), ne(subscriptions.status, "canceled")));
  return row ? { ...row, userId } : null;
}

const NOT_ALLOWED: ActionResult = {
  ok: false,
  message: "Dondurma hakkı yıllık pakete özel. Yardım için salon görevlisine başvurabilirsin.",
};

export async function freezeMySubscription(days: number): Promise<ActionResult> {
  if (!isFreezeDays(days)) return { ok: false, message: "Geçersiz dondurma süresi." };
  const sub = await ownLiveSubscription();
  if (!sub) return { ok: false, message: "Aktif bir üyeliğin bulunmuyor." };
  const blocker = freezeBlocker(sub);
  if (blocker) return { ok: false, message: blocker };
  if (!planAllowsSelfFreeze(await getPlanInfo(sub.planId))) return NOT_ALLOWED;

  console.info(`[freeze] member ${sub.userId} freezes ${sub.stripeSubscriptionId} for ${days} days`);
  const failure = await freezeInStripe(sub.stripeSubscriptionId, daysFromNow(days));
  refresh();
  return failure ?? { ok: true, message: `Üyeliğin ${days} gün donduruldu.` };
}

export async function unfreezeMySubscription(): Promise<ActionResult> {
  const sub = await ownLiveSubscription();
  if (!sub || sub.status !== "paused") return { ok: false, message: "Dondurulmuş bir üyeliğin yok." };
  if (!planAllowsSelfFreeze(await getPlanInfo(sub.planId))) return NOT_ALLOWED;

  console.info(`[freeze] member ${sub.userId} unfreezes ${sub.stripeSubscriptionId}`);
  const failure = await unfreezeInStripe(sub.stripeSubscriptionId);
  refresh();
  return failure ?? { ok: true, message: "Dondurma kaldırıldı, tekrar hoş geldin!" };
}
