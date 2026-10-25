import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";

// Idempotency ledger for reminder e-mails: at most one e-mail per
// subscription, kind and billing period, however often the job runs.
export const subscriptionReminders = pgTable(
  "subscription_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscription_reminders_once_idx").on(t.subscriptionId, t.kind, t.periodEnd)],
);
