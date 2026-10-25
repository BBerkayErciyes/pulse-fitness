import Stripe from "stripe";

let client: Stripe | undefined;

// Created on first use so `next build` does not need runtime secrets.
// API version is pinned by the installed SDK (stripe@23 → 2026-09-30.endive);
// bump it deliberately together with the package.
export function getStripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(secretKey, { appInfo: { name: "pulse-fitness" } });
  }
  return client;
}
