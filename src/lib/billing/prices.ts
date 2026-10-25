import { cacheLife } from "next/cache";
import { getPlanInfo, type PlanInfo } from "@/lib/subscriptions/dashboard";

/**
 * Stripe prices change rarely, so /pricing caches them for hours. A failed
 * lookup is cached only briefly so a Stripe hiccup doesn't stick around.
 */
export async function getCachedPlanInfo(priceId: string): Promise<PlanInfo> {
  "use cache";
  const info = await getPlanInfo(priceId);
  if (info.found) cacheLife("hours");
  else cacheLife("seconds");
  return info;
}
