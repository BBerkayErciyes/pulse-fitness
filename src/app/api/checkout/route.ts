import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { buildCheckoutSessionParams } from "@/lib/billing/checkout";
import { isPlanKey, priceIdFor } from "@/lib/billing/plans";
import { getStripe } from "@/lib/stripe";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store" };

function appUrl(request: Request): string {
  // Prefer the configured public URL; the request origin can be an internal
  // host behind a proxy and Stripe would redirect members there.
  return (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body: unknown = await request.json().catch(() => null);
  const plan = (body as { plan?: unknown } | null)?.plan;
  if (!isPlanKey(plan)) {
    return Response.json({ error: "invalid_plan" }, { status: 400, headers: NO_STORE });
  }

  const priceId = priceIdFor(plan);
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    console.error(`[checkout] Stripe is not configured for plan "${plan}"`);
    return Response.json({ error: "billing_not_configured" }, { status: 503, headers: NO_STORE });
  }

  const db = getDb();
  // One live subscription per user (DB partial unique index). Blocking here
  // stops a second checkout whose webhook would otherwise fail permanently.
  const [live] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), ne(subscriptions.status, "canceled")))
    .limit(1);
  if (live) {
    return Response.json({ error: "already_subscribed" }, { status: 409, headers: NO_STORE });
  }

  const [profile] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id));

  try {
    const session = await getStripe().checkout.sessions.create(
      buildCheckoutSessionParams({
        userId: user.id,
        priceId,
        appUrl: appUrl(request),
        customerId: profile?.stripeCustomerId ?? null,
        email: user.email,
      }),
    );
    if (!session.url) throw new Error(`Checkout session ${session.id} has no url`);
    return Response.json({ url: session.url }, { headers: NO_STORE });
  } catch (err) {
    console.error("[checkout] failed to create session:", err);
    return Response.json({ error: "checkout_failed" }, { status: 502, headers: NO_STORE });
  }
}
