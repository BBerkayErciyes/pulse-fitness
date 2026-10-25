import Stripe from "stripe";
import { getDb } from "@/db";
import { getStripe } from "@/lib/stripe";
import { InvalidSubscriptionTransitionError } from "./state-machine";
import { PermanentSyncError, syncStripeSubscription } from "./stripe-sync";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Stripe stays the source of truth: change the subscription there and
 * immediately sync our row from the object Stripe returns, so the UI reflects
 * it without waiting for the webhook. The webhook then arrives with the same
 * state and is a no-op transition. Returns null on full success.
 */
export async function applySubscriptionChange(
  run: (stripe: Stripe) => Promise<Stripe.Subscription>,
  stripeSubscriptionId: string,
): Promise<ActionResult | null> {
  let sub: Stripe.Subscription;
  try {
    sub = await run(getStripe());
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error(`[subscriptions] Stripe rejected change on ${stripeSubscriptionId}:`, err.message);
      return { ok: false, message: "Stripe bu işlemi reddetti. Abonelik Stripe'ta zaten sonlanmış olabilir." };
    }
    console.error(`[subscriptions] Stripe request failed for ${stripeSubscriptionId}:`, err);
    return { ok: false, message: "Ödeme sistemine ulaşılamadı. Biraz sonra tekrar dene." };
  }

  try {
    await getDb().transaction((tx) => syncStripeSubscription(tx, sub));
  } catch (err) {
    if (err instanceof PermanentSyncError || err instanceof InvalidSubscriptionTransitionError) {
      console.error(`[subscriptions] sync after change failed for ${stripeSubscriptionId}:`, err.message);
    } else {
      console.error(`[subscriptions] sync after change failed for ${stripeSubscriptionId}:`, err);
    }
    // The change is done in Stripe; the webhook will bring our row in line.
    return { ok: true, message: "İşlem Stripe'ta yapıldı; birkaç saniye içinde güncellenecek." };
  }
  return null;
}
