import { checkAccessEligibility } from "@/lib/access/eligibility";
import { ACCESS_TOKEN_TTL_SECONDS, issueAccessToken } from "@/lib/access/token";
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
  // The client renders `token` as the QR code. `expiresIn` lets it run the
  // countdown without depending on the device clock matching the server's.
  return Response.json(
    { token, expiresAt: expiresAt.toISOString(), expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    { headers: NO_STORE },
  );
}
