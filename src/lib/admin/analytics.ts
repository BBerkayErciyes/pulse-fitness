import { getPlanInfo, type PlanInfo } from "@/lib/subscriptions/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Analytics go through the admin_* RPCs (drizzle/0007, 0009) with the
// viewer's own JWT, so the database enforces the role itself: gate traffic is
// staff-readable, plan counts (revenue) admin-only. Callers still run
// requireStaff()/requireAdmin() first for the redirect.

export const ACCESS_CHART_DAYS = 7;

export interface DailyAccess {
  /** Calendar day in Europe/Istanbul, "YYYY-MM-DD". */
  day: string;
  granted: number;
  denied: number;
  uniqueMembers: number;
}

export interface PlanRevenue {
  planId: string;
  name: string;
  live: number;
  /** Monthly-normalized amount in minor units for one subscription; null if unknown. */
  monthlyAmount: number | null;
  currency: string | null;
}

// Average days per Stripe interval, to normalize any billing period to a month.
const MONTHS_PER_INTERVAL: Record<string, number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };

function monthlyAmount(plan: PlanInfo): number | null {
  if (plan.unitAmount === null || !plan.interval) return null;
  const months = MONTHS_PER_INTERVAL[plan.interval];
  return months ? plan.unitAmount / (months * plan.intervalCount) : null;
}

// PostgREST returns bigint as number for counts in this range; coerce anyway.
const n = (v: unknown) => Number(v ?? 0);

export async function getDailyAccess(): Promise<DailyAccess[]> {
  const supabase = await createSupabaseServerClient();
  const daily = await supabase.rpc("admin_access_daily", { p_days: ACCESS_CHART_DAYS });
  if (daily.error) throw new Error(`admin_access_daily failed: ${daily.error.message}`);
  return (daily.data as Record<string, unknown>[]).map((r) => ({
    day: String(r.day),
    granted: n(r.granted),
    denied: n(r.denied),
    uniqueMembers: n(r.unique_members),
  }));
}

/** Admin only: the RPC rejects staff. */
export async function getFinance() {
  const supabase = await createSupabaseServerClient();
  const plans = await supabase.rpc("admin_live_plan_counts");
  if (plans.error) throw new Error(`admin_live_plan_counts failed: ${plans.error.message}`);

  const planRows = plans.data as Record<string, unknown>[];
  const revenue: PlanRevenue[] = await Promise.all(
    planRows.map(async (r) => {
      const planId = String(r.plan_id);
      const info = await getPlanInfo(planId);
      return {
        planId,
        name: info.name,
        live: n(r.active) + n(r.past_due),
        monthlyAmount: monthlyAmount(info),
        currency: info.currency,
      };
    }),
  );

  // Past-due members still have access and are still being billed (Stripe
  // retries), so they count toward MRR; a scheduled cancel still pays this period.
  const mrrByCurrency = new Map<string, number>();
  for (const p of revenue) {
    if (p.monthlyAmount === null || !p.currency) continue;
    mrrByCurrency.set(p.currency, (mrrByCurrency.get(p.currency) ?? 0) + p.live * p.monthlyAmount);
  }

  return {
    revenue,
    liveSubscribers: planRows.reduce((sum, r) => sum + n(r.active) + n(r.past_due), 0),
    pastDue: planRows.reduce((sum, r) => sum + n(r.past_due), 0),
    ending: planRows.reduce((sum, r) => sum + n(r.ending), 0),
    mrr: [...mrrByCurrency].map(([currency, amount]) => ({ currency, amount: Math.round(amount) })),
    /** Plans whose price could not be read from Stripe (left out of MRR). */
    unpricedPlans: revenue.filter((p) => p.monthlyAmount === null && p.live > 0).length,
  };
}

export type Finance = Awaited<ReturnType<typeof getFinance>>;
