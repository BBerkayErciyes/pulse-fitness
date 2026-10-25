// Plans offered on /pricing. Clients only ever send a PlanKey; the Stripe
// price id is resolved here from server env, so nobody can check out an
// arbitrary price from the Stripe account.
export const PLAN_KEYS = ["monthly", "yearly"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface PlanDefinition {
  key: PlanKey;
  title: string;
  tagline: string;
  features: string[];
  highlighted: boolean;
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  monthly: {
    key: "monthly",
    title: "Aylık",
    tagline: "Taahhüt yok, istediğin zaman iptal et.",
    features: ["Sınırsız salon girişi", "QR ile temassız giriş", "Tüm ekipman ve alanlar", "Aylık esnek ödeme"],
    highlighted: false,
  },
  yearly: {
    key: "yearly",
    title: "Yıllık",
    tagline: "Bir yıl boyunca kesintisiz antrenman.",
    features: ["Aylık paketteki her şey", "Yıllık tek ödeme ile indirim", "Üyelik dondurma hakkı", "Öncelikli destek"],
    highlighted: true,
  },
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

/** Stripe price id for a plan, or null when it is not configured. */
export function priceIdFor(plan: PlanKey): string | null {
  const id = plan === "monthly" ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
  return id || null;
}
