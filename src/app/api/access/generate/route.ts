import { checkAccessEligibility } from "@/lib/access/eligibility";
import { issueAccessToken } from "@/lib/access/token";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const eligibility = await checkAccessEligibility(userId);
  if (!eligibility.eligible) {
    return Response.json({ error: eligibility.reason }, { status: 403, headers: NO_STORE });
  }

  const { token, expiresAt } = await issueAccessToken(userId);
  // The client renders `token` as the QR code and requests a new one before expiry.
  return Response.json({ token, expiresAt: expiresAt.toISOString() }, { headers: NO_STORE });
}
