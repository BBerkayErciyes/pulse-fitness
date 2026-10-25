import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptions, users, type SubscriptionStatus } from "@/db/schema";
import { hasAccess } from "@/lib/subscriptions/state-machine";

export type AccessEligibility =
  | { eligible: true; userId: string; fullName: string; status: SubscriptionStatus }
  | { eligible: false; reason: "user_not_found" | "no_subscription" | `subscription_${SubscriptionStatus}` };

/**
 * Reads the user's live (non-canceled) subscription straight from the database
 * and applies hasAccess(): only `active` and `past_due` may enter.
 */
export async function checkAccessEligibility(userId: string): Promise<AccessEligibility> {
  const [row] = await getDb()
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      status: subscriptions.status,
    })
    .from(users)
    .leftJoin(
      subscriptions,
      and(eq(subscriptions.userId, users.id), ne(subscriptions.status, "canceled")),
    )
    .where(eq(users.id, userId));

  if (!row) return { eligible: false, reason: "user_not_found" };
  if (!row.status) return { eligible: false, reason: "no_subscription" };
  if (!hasAccess(row.status)) return { eligible: false, reason: `subscription_${row.status}` };

  const fullName = `${row.firstName} ${row.lastName}`.trim();
  return { eligible: true, userId, fullName, status: row.status };
}
