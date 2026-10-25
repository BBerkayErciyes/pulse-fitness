import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { getStripe } from "@/lib/stripe";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Opens the Stripe Customer Portal for the signed-in member (cancel, change
 * card, invoices). Changes made there reach us through the existing
 * customer.subscription.* webhooks, so nothing is written here.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[billing] STRIPE_SECRET_KEY is not set");
    return Response.json({ error: "billing_not_configured" }, { status: 503, headers: NO_STORE });
  }

  // The customer id comes from our DB (set by the webhook), never from the
  // client, so a member can only ever open their own portal.
  const [profile] = await getDb()
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id));
  if (!profile?.stripeCustomerId) {
    return Response.json({ error: "no_billing_account" }, { status: 404, headers: NO_STORE });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${appUrl(request)}/dashboard`,
      locale: "tr",
    });
    return Response.json({ url: session.url }, { headers: NO_STORE });
  } catch (err) {
    // Most common cause in a new account: the portal's default configuration
    // was never saved (Stripe Dashboard → Settings → Billing → Customer portal).
    console.error("[billing] failed to create portal session:", err);
    return Response.json({ error: "portal_failed" }, { status: 502, headers: NO_STORE });
  }
}
