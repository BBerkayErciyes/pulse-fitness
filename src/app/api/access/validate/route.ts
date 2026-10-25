import { decideGateEntry, MAX_GATE_ID_LENGTH, MAX_TOKEN_LENGTH } from "@/lib/access/gate-decision";
import { isAuthorizedGate } from "@/lib/access/gate-auth";

const NO_STORE = { "Cache-Control": "no-store" };

// Original (Phase 4) gate API, kept for clients already integrated against it.
// New hardware should use /api/gate/verify, which shares the same decision.
export async function POST(request: Request) {
  if (!isAuthorizedGate(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const body: unknown = await request.json().catch(() => null);
  const token = (body as { token?: unknown } | null)?.token;
  const gateIdRaw = (body as { gate_id?: unknown } | null)?.gate_id;
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return Response.json({ error: "token is required" }, { status: 400, headers: NO_STORE });
  }
  const gateId = typeof gateIdRaw === "string" ? gateIdRaw.slice(0, MAX_GATE_ID_LENGTH) : null;

  const decision = await decideGateEntry(token, gateId);
  if (!decision.granted) {
    return Response.json({ access: false, reason: decision.reason }, { headers: NO_STORE });
  }
  return Response.json({ access: true, user: decision.fullName }, { headers: NO_STORE });
}
