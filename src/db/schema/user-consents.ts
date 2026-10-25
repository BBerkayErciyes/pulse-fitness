import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Evidence of accepted legal texts. One row per document version, so a new
// version of a text needs a fresh acceptance while the old proof is kept.
export const userConsents = pgTable(
  "user_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    document: text("document").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [
    // Leads with user_id, so it also serves "consents of this user" lookups.
    uniqueIndex("user_consents_user_document_version_idx").on(t.userId, t.document, t.version),
  ],
);

export type UserConsent = typeof userConsents.$inferSelect;
