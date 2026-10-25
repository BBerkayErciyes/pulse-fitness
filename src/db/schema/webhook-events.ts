import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { webhookEventStatus } from "./enums";

// Idempotency ledger: insert the provider's event id with ON CONFLICT DO NOTHING
// before handling; if no row was inserted, the event was already seen.
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull().unique(),
    type: text("type").notNull(),
    status: webhookEventStatus("status").notNull().default("received"),
    payload: jsonb("payload"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("webhook_events_status_idx").on(t.status)],
);

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
