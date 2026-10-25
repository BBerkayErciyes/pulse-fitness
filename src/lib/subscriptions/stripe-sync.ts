import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Db } from "@/db";
import { subscriptions, users, type SubscriptionStatus } from "@/db/schema";
import { assertTransition } from "./state-machine";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Errors that retrying the webhook will never fix. The event is recorded as
// `failed` and acknowledged so Stripe stops redelivering it.
export class PermanentSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentSyncError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Maps a Stripe subscription to our status enum. Returns null for `incomplete`
 * (first payment still pending) — such subscriptions are not stored yet.
 */
export function mapStripeStatus(sub: Stripe.Subscription): SubscriptionStatus | null {
  switch (sub.status) {
    case "active":
    case "trialing":
      // Dashboard "pause payment collection" keeps Stripe status `active`.
      return sub.pause_collection ? "paused" : "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return null;
    default:
      throw new PermanentSyncError(`Unknown Stripe subscription status: ${sub.status}`);
  }
}

function customerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

async function resolveUserId(
  tx: Tx,
  sub: Stripe.Subscription,
  userIdHint: string | null,
): Promise<string> {
  const candidate = sub.metadata.user_id || userIdHint;
  if (candidate) {
    if (!UUID_RE.test(candidate)) {
      throw new PermanentSyncError(`Invalid user id on subscription ${sub.id}: ${candidate}`);
    }
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, candidate));
    if (!user) {
      throw new PermanentSyncError(`User ${candidate} for subscription ${sub.id} does not exist`);
    }
    return user.id;
  }

  const [byCustomer] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId(sub)));
  if (!byCustomer) {
    throw new PermanentSyncError(`Cannot resolve user for subscription ${sub.id}`);
  }
  return byCustomer.id;
}

/**
 * Upserts our subscriptions row from the authoritative Stripe subscription,
 * enforcing the state machine on status changes.
 */
export async function syncStripeSubscription(
  tx: Tx,
  sub: Stripe.Subscription,
  userIdHint: string | null = null,
): Promise<void> {
  const status = mapStripeStatus(sub);
  if (status === null) return;

  // Since API 2025-03-31 billing periods live on subscription items.
  const item = sub.items.data[0];
  if (!item) {
    throw new PermanentSyncError(`Subscription ${sub.id} has no items`);
  }

  const fields = {
    planId: item.price.id,
    status,
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    pauseResumesAt:
      status === "paused" && sub.pause_collection?.resumes_at
        ? new Date(sub.pause_collection.resumes_at * 1000)
        : null,
    // Stripe also sets canceled_at when a cancellation is merely scheduled;
    // we only record it once the subscription is actually canceled.
    canceledAt:
      status === "canceled"
        ? new Date((sub.canceled_at ?? sub.ended_at ?? Math.floor(Date.now() / 1000)) * 1000)
        : null,
  };

  const [existing] = await tx
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .for("update");

  if (existing) {
    // Same-status updates (renewals, plan changes) are not transitions.
    if (existing.status !== status) {
      assertTransition(existing.status, status);
    }
    await tx.update(subscriptions).set(fields).where(eq(subscriptions.id, existing.id));
    return;
  }

  // Never seen and already over (e.g. incomplete_expired): nothing to track.
  if (status === "canceled") return;

  const userId = await resolveUserId(tx, sub, userIdHint);
  await tx
    .update(users)
    .set({ stripeCustomerId: customerId(sub) })
    .where(eq(users.id, userId));
  await tx.insert(subscriptions).values({ userId, stripeSubscriptionId: sub.id, ...fields });
}
