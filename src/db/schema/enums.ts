import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "member"]);

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
