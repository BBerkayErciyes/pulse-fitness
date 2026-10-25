import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

export type GateAuthResult = "ok" | "unauthorized" | "misconfigured";

/**
 * Gate hardware authenticates with `Authorization: Bearer <GATE_API_KEY>`, or
 * `X-Gate-Key: <GATE_API_KEY>` for controllers that cannot set Authorization.
 * Without it anyone could probe tokens and harvest member names.
 * A missing GATE_API_KEY fails closed ("misconfigured"), never open.
 */
export function checkGateAuth(request: Request): GateAuthResult {
  const expected = process.env.GATE_API_KEY;
  if (!expected) return "misconfigured";
  const provided =
    request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.headers.get("x-gate-key");
  if (!provided) return "unauthorized";
  // Hashing first gives equal-length buffers, as timingSafeEqual requires.
  return timingSafeEqual(digest(provided), digest(expected)) ? "ok" : "unauthorized";
}

export function isAuthorizedGate(request: Request): boolean {
  const result = checkGateAuth(request);
  if (result === "misconfigured") {
    throw new Error("GATE_API_KEY is not set");
  }
  return result === "ok";
}
