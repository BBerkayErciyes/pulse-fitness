import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Audit trail of gate scans. The partial unique index on token_id makes each
// QR token single-use: a second grant with the same jti fails to insert.
export const accessLogs = pgTable(
  "access_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    tokenId: text("token_id"),
    gateId: text("gate_id"),
    granted: boolean("granted").notNull(),
    reason: text("reason"),
    // Set for entries recorded by staff (reason = 'manual_bypass').
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("access_logs_user_id_created_at_idx").on(t.userId, t.createdAt),
    // Admin gate history lists every scan newest-first.
    index("access_logs_created_at_idx").on(t.createdAt),
    uniqueIndex("access_logs_token_id_granted_idx")
      .on(t.tokenId)
      .where(sql`${t.granted}`),
  ],
);

export type AccessLog = typeof accessLogs.$inferSelect;
export type NewAccessLog = typeof accessLogs.$inferInsert;
