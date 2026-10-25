import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { InvalidSubscriptionTransitionError } from "@/lib/subscriptions/state-machine";
import { PermanentSyncError, syncStripeSubscription, type Tx } from "@/lib/subscriptions/stripe-sync";

export type ProcessOutcome = "processed" | "duplicate" | "failed" | "ignored";

const HANDLED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/**
 * Idempotent event processing. Everything runs in ONE transaction:
 *
 *  1. INSERT event_id ... ON CONFLICT DO NOTHING. No row back → already seen → skip.
 *     A concurrent duplicate blocks on the unique index until the first delivery
 *     commits (then it is skipped) or rolls back (then it takes over).
 *  2. Handle the event and mark it `processed`.
 *  3. Transient error (DB, Stripe API) → throw → whole transaction rolls back,
 *     including the event row, so Stripe's retry is processed normally.
 *     Permanent error → handler writes are rolled back to a savepoint, the event
 *     is committed as `failed`, and Stripe gets a 200 so it stops retrying.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<ProcessOutcome> {
  if (!HANDLED_EVENTS.has(event.type)) return "ignored";

  return getDb().transaction(async (tx) => {
    const [inserted] = await tx
      .insert(webhookEvents)
      .values({ eventId: event.id, type: event.type, payload: event })
      .onConflictDoNothing({ target: webhookEvents.eventId })
      .returning({ id: webhookEvents.id });

    if (!inserted) return "duplicate";

    try {
      await tx.transaction((sp) => handleEvent(sp, event));
    } catch (err) {
      if (err instanceof PermanentSyncError || err instanceof InvalidSubscriptionTransitionError) {
        console.error(`[stripe-webhook] ${event.id} (${event.type}) failed permanently:`, err.message);
        await tx
          .update(webhookEvents)
          .set({ status: "failed", error: err.message, processedAt: new Date() })
          .where(eq(webhookEvents.id, inserted.id));
        return "failed";
      }
      throw err;
    }

    await tx
      .update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, inserted.id));
    return "processed";
  });
}

async function handleEvent(tx: Tx, event: Stripe.Event): Promise<void> {
  // Events can arrive out of order, so we always re-fetch the subscription and
  // sync from Stripe's current state rather than trusting the event snapshot.
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription(tx, sub, session.client_reference_id);
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = await getStripe().subscriptions.retrieve(event.data.object.id);
      await syncStripeSubscription(tx, sub);
      return;
    }
  }
}
