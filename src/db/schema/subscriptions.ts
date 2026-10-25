import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { subscriptionStatus } from "./enums";
import { users } from "./users";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    // Stripe price id of the subscription's (first) item.
    planId: text("plan_id").notNull(),
    status: subscriptionStatus("status").notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("subscriptions_user_id_idx").on(t.userId),
    index("subscriptions_status_period_end_idx").on(t.status, t.currentPeriodEnd),
    // A user may have many historical (canceled) rows but only one live subscription.
    uniqueIndex("subscriptions_one_live_per_user_idx")
      .on(t.userId)
      .where(sql`${t.status} <> 'canceled'`),
    check("subscriptions_period_order_chk", sql`${t.currentPeriodEnd} > ${t.currentPeriodStart}`),
    check(
      "subscriptions_canceled_at_chk",
      sql`(${t.status} = 'canceled') = (${t.canceledAt} IS NOT NULL)`,
    ),
  ],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
