import type { SubscriptionStatus } from "@/db/schema";

// Allowed status transitions. `canceled` is terminal: re-subscribing creates a
// new subscriptions row (the partial unique index allows it once the old one is canceled).
export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  active: ["past_due", "paused", "canceled"],
  past_due: ["active", "canceled"],
  paused: ["active", "canceled"],
  canceled: [],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

export class InvalidSubscriptionTransitionError extends Error {
  constructor(
    readonly from: SubscriptionStatus,
    readonly to: SubscriptionStatus,
  ) {
    super(`Invalid subscription transition: ${from} -> ${to}`);
    this.name = "InvalidSubscriptionTransitionError";
  }
}

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidSubscriptionTransitionError(from, to);
  }
}

// Members keep access while past_due (grace period during payment retries).
export function hasAccess(status: SubscriptionStatus): boolean {
  return status === "active" || status === "past_due";
}
