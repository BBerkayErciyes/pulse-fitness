"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { recordManualBypass } from "@/lib/access/manual-bypass";
import { authorizeAction } from "@/lib/admin/auth";
import { daysFromNow, freezeBlocker, freezeInStripe, isFreezeDays, unfreezeInStripe } from "@/lib/subscriptions/freeze";
import { ADMIN_ACCESS_REASON_LABELS } from "@/lib/subscriptions/labels";
import { applySubscriptionChange, type ActionResult } from "@/lib/subscriptions/stripe-actions";

export type CancelMode = "now" | "period_end";
export type AdminActionResult = ActionResult;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN: AdminActionResult = { ok: false, message: "Bu işlem için yetkin yok." };

// Server Actions are public POST endpoints: every action re-checks the role
// itself and trusts only our own row ids from the client. Subscription
// changes are admin-only; staff may only record manual entries.
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

export async function cancelMemberSubscription(subscriptionId: string, mode: CancelMode): Promise<AdminActionResult> {
  const admin = await authorizeAction("admin");
  if (!admin) return FORBIDDEN;
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

  const failure = await applySubscriptionChange(
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
  const admin = await authorizeAction("admin");
  if (!admin) return FORBIDDEN;

  const row = await loadSubscription(subscriptionId);
  if (!row) return { ok: false, message: "Abonelik bulunamadı." };
  if (row.status === "canceled" || !row.cancelAtPeriodEnd) {
    return { ok: false, message: "Geri alınacak planlanmış bir iptal yok." };
  }

  console.info(`[admin] ${admin.id} resumes ${row.stripeSubscriptionId} (user ${row.userId})`);
  const failure = await applySubscriptionChange(
    (stripe) => stripe.subscriptions.update(row.stripeSubscriptionId, { cancel_at_period_end: false }),
    row.stripeSubscriptionId,
  );

  refresh();
  return failure ?? { ok: true, message: "Planlanmış iptal geri alındı." };
}

/** `days` null = until unfrozen by hand. Admins may freeze any plan. */
export async function freezeMemberSubscription(subscriptionId: string, days: number | null): Promise<AdminActionResult> {
  const admin = await authorizeAction("admin");
  if (!admin) return FORBIDDEN;
  if (days !== null && !isFreezeDays(days)) return { ok: false, message: "Geçersiz dondurma süresi." };

  const row = await loadSubscription(subscriptionId);
  if (!row) return { ok: false, message: "Abonelik bulunamadı." };
  const blocker = freezeBlocker(row);
  if (blocker) return { ok: false, message: blocker };

  console.info(`[admin] ${admin.id} freezes ${row.stripeSubscriptionId} (user ${row.userId}, days=${days ?? "open"})`);
  const failure = await freezeInStripe(row.stripeSubscriptionId, days === null ? null : daysFromNow(days));
  refresh();
  return failure ?? { ok: true, message: days === null ? "Üyelik süresiz donduruldu." : `Üyelik ${days} gün donduruldu.` };
}

export async function unfreezeMemberSubscription(subscriptionId: string): Promise<AdminActionResult> {
  const admin = await authorizeAction("admin");
  if (!admin) return FORBIDDEN;

  const row = await loadSubscription(subscriptionId);
  if (!row) return { ok: false, message: "Abonelik bulunamadı." };
  if (row.status !== "paused") return { ok: false, message: "Bu üyelik dondurulmuş değil." };

  console.info(`[admin] ${admin.id} unfreezes ${row.stripeSubscriptionId} (user ${row.userId})`);
  const failure = await unfreezeInStripe(row.stripeSubscriptionId);
  refresh();
  return failure ?? { ok: true, message: "Dondurma kaldırıldı, üyelik yeniden aktif." };
}

/** Front desk: let a member in by hand (turnstile fault, forgotten phone). */
export async function manualBypass(userId: string, note: string): Promise<AdminActionResult> {
  const actor = await authorizeAction("staff");
  if (!actor) return FORBIDDEN;
  if (typeof userId !== "string" || !UUID_RE.test(userId)) return { ok: false, message: "Üye bulunamadı." };

  const result = await recordManualBypass({ userId, actorId: actor.id, note: typeof note === "string" ? note : null });
  if (!result.ok) {
    if (result.reason === "duplicate") return { ok: false, message: "Bu üye için az önce giriş kaydedildi." };
    if (result.reason === "user_not_found") return { ok: false, message: "Üye bulunamadı." };
    const why = (result.detail && ADMIN_ACCESS_REASON_LABELS[result.detail]) ?? "Üyelik aktif değil";
    return { ok: false, message: `Manuel geçiş yapılamaz: ${why}.` };
  }

  console.info(`[admin] ${actor.role} ${actor.id} manual bypass for user ${userId}`);
  refresh();
  return { ok: true, message: `${result.fullName} için manuel geçiş kaydedildi.` };
}
