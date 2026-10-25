import { cache } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accessLogs, subscriptions, users } from "@/db/schema";
import { getStripe } from "@/lib/stripe";

const INTERVAL_LABELS: Record<string, string> = { day: "gün", week: "hafta", month: "ay", year: "yıl" };

export interface PlanInfo {
  name: string;
  price: string | null;
}

/**
 * Human-readable plan from the Stripe price id. Falls back to the raw id if
 * Stripe is unreachable or the price does not exist, so the dashboard still renders.
 */
export const getPlanInfo = cache(async (priceId: string): Promise<PlanInfo> => {
  try {
    const price = await getStripe().prices.retrieve(priceId, { expand: ["product"] });
    const product = typeof price.product === "string" || "deleted" in price.product ? null : price.product;
    const amount =
      price.unit_amount === null
        ? null
        : new Intl.NumberFormat("tr-TR", { style: "currency", currency: price.currency.toUpperCase() }).format(
            price.unit_amount / 100,
          );
    const interval = price.recurring ? (INTERVAL_LABELS[price.recurring.interval] ?? null) : null;
    return {
      name: product?.name ?? price.nickname ?? priceId,
      price: amount && interval ? `${amount} / ${interval}` : amount,
    };
  } catch {
    return { name: priceId, price: null };
  }
});

// Queries run through Drizzle (bypassing RLS), so every one is scoped to the
// verified user id passed in by the caller.
export async function getMemberDashboard(userId: string) {
  const db = getDb();

  const [profile] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId));

  // Prefer the live subscription; otherwise show the most recent ended one.
  const [subscription] = await db
    .select({
      planId: subscriptions.planId,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(sql`${subscriptions.status} = 'canceled'`, desc(subscriptions.createdAt))
    .limit(1);

  const recentVisits = await db
    .select({ id: accessLogs.id, createdAt: accessLogs.createdAt, granted: accessLogs.granted, reason: accessLogs.reason })
    .from(accessLogs)
    .where(eq(accessLogs.userId, userId))
    .orderBy(desc(accessLogs.createdAt))
    .limit(5);

  return { profile: profile ?? null, subscription: subscription ?? null, recentVisits };
}

export type MemberDashboard = Awaited<ReturnType<typeof getMemberDashboard>>;
export type DashboardSubscription = NonNullable<MemberDashboard["subscription"]>;
