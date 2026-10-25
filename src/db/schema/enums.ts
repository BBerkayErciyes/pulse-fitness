import { pgEnum } from "drizzle-orm/pg-core";

// staff: front desk. Sees members and gate logs, may record manual entries;
// no finance (revenue, Stripe) and no subscription changes.
export const userRole = pgEnum("user_role", ["admin", "staff", "member"]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "paused",
]);

export const webhookEventStatus = pgEnum("webhook_event_status", [
  "received",
  "processed",
  "failed",
]);

export type UserRole = (typeof userRole.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];
export type WebhookEventStatus = (typeof webhookEventStatus.enumValues)[number];
