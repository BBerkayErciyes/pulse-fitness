import type { SubscriptionStatus } from "@/db/schema";
import type { PlanInfo } from "./dashboard";
import { applySubscriptionChange, type ActionResult } from "./stripe-actions";

// Freezing uses Stripe's pause_collection with behavior "void": invoices
// created while frozen are voided, so the member is not charged. Our sync maps
// a paused-collection subscription to status "paused", which hasAccess()
// rejects, so the gate and QR generation deny frozen members.

/** Durations a member can pick for a self-service freeze. */
export const FREEZE_DURATIONS_DAYS = [7, 14, 30] as const;
export type FreezeDays = (typeof FREEZE_DURATIONS_DAYS)[number];

export const isFreezeDays = (value: unknown): value is FreezeDays =>
  typeof value === "number" && (FREEZE_DURATIONS_DAYS as readonly number[]).includes(value);

/** Self-service freeze is a yearly-plan perk (see the /pricing feature list). */
export const planAllowsSelfFreeze = (plan: Pick<PlanInfo, "interval">) => plan.interval === "year";

export function freezeBlocker(sub: { status: SubscriptionStatus; cancelAtPeriodEnd: boolean }): string | null {
  if (sub.status === "paused") return "Üyelik zaten dondurulmuş.";
  if (sub.status !== "active") return "Yalnızca aktif bir üyelik dondurulabilir.";
  if (sub.cancelAtPeriodEnd) return "Dönem sonunda bitecek bir üyelik dondurulamaz.";
  return null;
}

/** Freeze until `resumesAt` (Stripe resumes automatically), or indefinitely with null. */
export function freezeInStripe(stripeSubscriptionId: string, resumesAt: Date | null): Promise<ActionResult | null> {
  return applySubscriptionChange(
    (stripe) =>
      stripe.subscriptions.update(stripeSubscriptionId, {
        pause_collection: {
          behavior: "void",
          ...(resumesAt ? { resumes_at: Math.floor(resumesAt.getTime() / 1000) } : {}),
        },
      }),
    stripeSubscriptionId,
  );
}

export function unfreezeInStripe(stripeSubscriptionId: string): Promise<ActionResult | null> {
  // An empty string clears pause_collection in the Stripe API.
  return applySubscriptionChange(
    (stripe) => stripe.subscriptions.update(stripeSubscriptionId, { pause_collection: "" }),
    stripeSubscriptionId,
  );
}

export const daysFromNow = (days: number, now = Date.now()) => new Date(now + days * 24 * 60 * 60 * 1000);
