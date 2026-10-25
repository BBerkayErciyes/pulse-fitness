import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Gate hardware authenticates with `Authorization: Bearer <GATE_API_KEY>`.
 * Without it anyone could probe tokens and harvest member names.
 */
export function isAuthorizedGate(request: Request): boolean {
  const expected = process.env.GATE_API_KEY;
  if (!expected) {
    throw new Error("GATE_API_KEY is not set");
  }
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!provided) return false;
  // Hashing first gives equal-length buffers, as timingSafeEqual requires.
  return timingSafeEqual(digest(provided), digest(expected));
}
