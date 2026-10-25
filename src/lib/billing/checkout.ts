import type Stripe from "stripe";

export interface CheckoutInput {
  userId: string;
  priceId: string;
  appUrl: string;
  /** Existing Stripe customer, reused so a member never gets duplicate customers. */
  customerId: string | null;
  email: string | null;
}

/**
 * Checkout Session params. The user id is attached twice on purpose:
 * - client_reference_id: read by the checkout.session.completed handler.
 * - subscription_data.metadata.user_id: lives on the subscription itself, so
 *   customer.subscription.* events can be linked even if they arrive first.
 */
export function buildCheckoutSessionParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.userId,
    subscription_data: { metadata: { user_id: input.userId } },
    metadata: { user_id: input.userId },
    ...(input.customerId
      ? { customer: input.customerId }
      : input.email
        ? { customer_email: input.email }
        : {}),
    allow_promotion_codes: true,
    locale: "tr",
    success_url: `${input.appUrl}/dashboard?success=true`,
    cancel_url: `${input.appUrl}/dashboard?canceled=true`,
  };
}
