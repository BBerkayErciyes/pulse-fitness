import { checkGateAuth } from "@/lib/access/gate-auth";
import { decideGateEntry, MAX_GATE_ID_LENGTH, MAX_TOKEN_LENGTH, type DenyReason } from "@/lib/access/gate-decision";

/**
 * Turnstile endpoint for physical gate controllers.
 *
 *   POST /api/gate/verify
 *   Authorization: Bearer <GATE_API_KEY>      (or X-Gate-Key: <GATE_API_KEY>)
 *   Content-Type: application/json            {"token": "<scanned QR>", "gate_id": "main-1"}
 *            or   text/plain                  <scanned QR>   (+ optional X-Gate-Id header)
 *
 * Every response body carries `action`, so a controller only needs one rule:
 * open the relay iff action === "open". Anything else, including network and
 * server errors, means stay closed.
 *
 *   {"action":"open","reason":null,"message":"Hoş geldin, Ayşe!"}
 *   {"action":"deny","reason":"token_expired","message":"QR kodun süresi doldu."}
 */

const HEADERS = { "Cache-Control": "no-store" };

// Short texts for a gate display. First name only: the screen is public.
const DENY_MESSAGES: Record<string, string> = {
  token_expired: "QR kodun süresi doldu. Yenileyip tekrar okut.",
  invalid_token: "Geçersiz QR kod.",
  token_already_used: "Bu QR kod zaten kullanıldı.",
  user_not_found: "Üye bulunamadı.",
  no_subscription: "Aktif üyelik bulunamadı.",
  subscription_paused: "Üyeliğin dondurulmuş.",
  subscription_canceled: "Üyeliğin iptal edilmiş.",
  unauthorized: "Cihaz yetkili değil.",
  bad_request: "QR kod okunamadı.",
  gate_not_configured: "Turnike yapılandırılmamış.",
  server_error: "Sistem hatası. Lütfen görevliye başvur.",
};

type GateReason = DenyReason | "unauthorized" | "bad_request" | "gate_not_configured" | "server_error";

function deny(reason: GateReason, status = 200) {
  return Response.json(
    { action: "deny", reason, message: DENY_MESSAGES[reason] ?? "Giriş reddedildi." },
    { status, headers: HEADERS },
  );
}

async function readScan(request: Request): Promise<{ token: string | null; gateId: string | null }> {
  const headerGateId = request.headers.get("x-gate-id");
  const contentType = request.headers.get("content-type") ?? "";
  let token: unknown = null;
  let gateId: unknown = headerGateId;

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    // `qr` is accepted as an alias; some scanner firmwares name the field that way.
    token = body?.token ?? body?.qr ?? null;
    gateId = body?.gate_id ?? headerGateId;
  } else {
    // Raw scanner output; trim the CR/LF many barcode readers append.
    token = (await request.text().catch(() => "")).trim();
  }

  const scanned = typeof token === "string" ? token.trim() : "";
  return {
    token: scanned.length > 0 && scanned.length <= MAX_TOKEN_LENGTH ? scanned : null,
    gateId: typeof gateId === "string" && gateId.trim() ? gateId.trim().slice(0, MAX_GATE_ID_LENGTH) : null,
  };
}

export async function POST(request: Request) {
  const auth = checkGateAuth(request);
  if (auth === "misconfigured") {
    console.error("[gate] GATE_API_KEY is not set; refusing all scans");
    return deny("gate_not_configured", 503);
  }
  if (auth === "unauthorized") return deny("unauthorized", 401);

  const { token, gateId } = await readScan(request);
  if (!token) return deny("bad_request", 400);

  try {
    const decision = await decideGateEntry(token, gateId);
    if (!decision.granted) return deny(decision.reason);
    return Response.json(
      { action: "open", reason: null, message: `Hoş geldin, ${decision.firstName || "üye"}!` },
      { headers: HEADERS },
    );
  } catch (err) {
    // Fail closed: a DB or config outage must never open the gate.
    console.error("[gate] verify failed:", err);
    return deny("server_error", 500);
  }
}

/** Installer check: confirms reachability and the device key without scanning. */
export async function GET(request: Request) {
  const auth = checkGateAuth(request);
  if (auth === "misconfigured") return Response.json({ ok: false, error: "gate_not_configured" }, { status: 503, headers: HEADERS });
  if (auth === "unauthorized") return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: HEADERS });
  return Response.json({ ok: true, serverTime: new Date().toISOString() }, { headers: HEADERS });
}
