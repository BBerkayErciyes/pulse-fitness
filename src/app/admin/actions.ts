"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import Stripe from "stripe";
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { getStripe } from "@/lib/stripe";
import { InvalidSubscriptionTransitionError } from "@/lib/subscriptions/state-machine";
import { PermanentSyncError, syncStripeSubscription } from "@/lib/subscriptions/stripe-sync";

export type CancelMode = "now" | "period_end";
export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server Actions are public POST endpoints: every action re-checks the admin
// role itself and trusts only our own subscription row id from the client.
async function loadSubscription(subscriptionId: unknown) {
  if (typeof subscriptionId !== "string" || !UUID_RE.test(subscriptionId)) return null;
  const [row] = await getDb()
    .select({
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      status: subscriptions.status,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      userId: subscriptions.userId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId));
  return row ?? null;
}

/**
 * Stripe stays the source of truth: we change the subscription there and
 * immediately sync our row from the object Stripe returns, so the panel
 * reflects it without waiting for the webhook. The webhook then arrives with
 * the same state and is a no-op transition.
 */
async function applyInStripe(
  run: (stripe: Stripe) => Promise<Stripe.Subscription>,
  stripeSubscriptionId: string,
): Promise<AdminActionResult | null> {
  let sub: Stripe.Subscription;
  try {
    sub = await run(getStripe());
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error(`[admin] Stripe rejected change on ${stripeSubscriptionId}:`, err.message);
      return { ok: false, message: "Stripe bu işlemi reddetti. Abonelik Stripe'ta zaten sonlanmış olabilir." };
    }
    console.error(`[admin] Stripe request failed for ${stripeSubscriptionId}:`, err);
    return { ok: false, message: "Ödeme sistemine ulaşılamadı. Biraz sonra tekrar dene." };
  }

  try {
    await getDb().transaction((tx) => syncStripeSubscription(tx, sub));
  } catch (err) {
    if (err instanceof PermanentSyncError || err instanceof InvalidSubscriptionTransitionError) {
      console.error(`[admin] sync after change failed for ${stripeSubscriptionId}:`, err.message);
    } else {
      console.error(`[admin] sync after change failed for ${stripeSubscriptionId}:`, err);
    }
    // The change is done in Stripe; the webhook will bring our row in line.
    return { ok: true, message: "İşlem Stripe'ta yapıldı; panel birkaç saniye içinde güncellenecek." };
  }
  return null;
}

export async function cancelMemberSubscription(subscriptionId: string, mode: CancelMode): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (mode !== "now" && mode !== "period_end") return { ok: false, message: "Geçersiz iptal türü." };

  const row = await loadSubscription(subscriptionId);
  if (!row) return { ok: false, message: "Abonelik bulunamadı." };
  if (row.status === "canceled") return { ok: false, message: "Bu abonelik zaten iptal edilmiş." };
  if (mode === "period_end" && row.cancelAtPeriodEnd) {
    return { ok: false, message: "Bu abonelik zaten dönem sonunda bitecek şekilde ayarlı." };
  }

  // Recorded on the Stripe subscription, which doubles as the audit trail.
  const cancellation_details = { comment: `Pulse admin panel: canceled by admin ${admin.id}` };
  console.info(`[admin] ${admin.id} cancels ${row.stripeSubscriptionId} (user ${row.userId}, mode=${mode})`);

  const failure = await applyInStripe(
    (stripe) =>
      mode === "now"
        ? stripe.subscriptions.cancel(row.stripeSubscriptionId, { cancellation_details })
        : stripe.subscriptions.update(row.stripeSubscriptionId, { cancel_at_period_end: true, cancellation_details }),
    row.stripeSubscriptionId,
  );

  refresh();
  if (failure) return failure;
  return {
    ok: true,
    message: mode === "now" ? "Abonelik hemen iptal edildi." : "Abonelik dönem sonunda sona erecek.",
  };
}

export async function resumeMemberSubscription(subscriptionId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  const row = await loadSubscription(subscriptionId);
  if (!row) return { ok: false, message: "Abonelik bulunamadı." };
  if (row.status === "canceled" || !row.cancelAtPeriodEnd) {
    return { ok: false, message: "Geri alınacak planlanmış bir iptal yok." };
  }

  console.info(`[admin] ${admin.id} resumes ${row.stripeSubscriptionId} (user ${row.userId})`);
  const failure = await applyInStripe(
    (stripe) => stripe.subscriptions.update(row.stripeSubscriptionId, { cancel_at_period_end: false }),
    row.stripeSubscriptionId,
  );

  refresh();
  return failure ?? { ok: true, message: "Planlanmış iptal geri alındı." };
}
