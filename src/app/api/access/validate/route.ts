import { getDb } from "@/db";
import { accessLogs } from "@/db/schema";
import { checkAccessEligibility } from "@/lib/access/eligibility";
import { isAuthorizedGate } from "@/lib/access/gate-auth";
import { verifyAccessToken } from "@/lib/access/token";

const NO_STORE = { "Cache-Control": "no-store" };

function deny(reason: string) {
  return Response.json({ access: false, reason }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isAuthorizedGate(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body: unknown = await request.json().catch(() => null);
  const token = (body as { token?: unknown } | null)?.token;
  const gateIdRaw = (body as { gate_id?: unknown } | null)?.gate_id;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return Response.json({ error: "token is required" }, { status: 400, headers: NO_STORE });
  }
  const gateId = typeof gateIdRaw === "string" ? gateIdRaw.slice(0, 64) : null;

  const db = getDb();
  const verified = await verifyAccessToken(token);
  if (!verified.ok) {
    await db.insert(accessLogs).values({ gateId, granted: false, reason: verified.reason });
    return deny(verified.reason);
  }

  // Final, authoritative check against the database at the moment of entry.
  const eligibility = await checkAccessEligibility(verified.userId);
  if (!eligibility.eligible) {
    await db.insert(accessLogs).values({
      userId: eligibility.reason === "user_not_found" ? null : verified.userId,
      tokenId: verified.tokenId,
      gateId,
      granted: false,
      reason: eligibility.reason,
    });
    return deny(eligibility.reason);
  }

  // Single-use: the partial unique index rejects a second grant for the same jti,
  // so a screenshot of the QR cannot let a second person in within the TTL.
  const [granted] = await db
    .insert(accessLogs)
    .values({ userId: verified.userId, tokenId: verified.tokenId, gateId, granted: true })
    .onConflictDoNothing()
    .returning({ id: accessLogs.id });

  if (!granted) {
    await db.insert(accessLogs).values({
      userId: verified.userId,
      tokenId: verified.tokenId,
      gateId,
      granted: false,
      reason: "token_already_used",
    });
    return deny("token_already_used");
  }

  return Response.json({ access: true, user: eligibility.fullName }, { headers: NO_STORE });
}
