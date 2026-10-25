import { relations } from "drizzle-orm";
import { accessLogs } from "./access-logs";
import { subscriptions } from "./subscriptions";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  accessLogs: many(accessLogs),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  user: one(users, {
    fields: [accessLogs.userId],
    references: [users.id],
  }),
}));
