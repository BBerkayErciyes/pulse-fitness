import { getDb } from "@/db";
import { accessLogs } from "@/db/schema";
import { checkAccessEligibility } from "./eligibility";
import { verifyAccessToken } from "./token";

export const MAX_TOKEN_LENGTH = 2048;
export const MAX_GATE_ID_LENGTH = 64;

export type DenyReason =
  | "token_expired"
  | "invalid_token"
  | "token_already_used"
  | "user_not_found"
  | "no_subscription"
  | `subscription_${string}`;

export type GateDecision =
  | { granted: true; userId: string; firstName: string; fullName: string }
  | { granted: false; reason: DenyReason };

/**
 * The single entry decision shared by every gate endpoint. Every outcome,
 * granted or not, is written to access_logs before returning.
 *
 *  1. Verify the QR JWT (signature, issuer/audience, 30 s expiry).
 *  2. Re-check the member's subscription in the database at this instant.
 *  3. Grant at most once per token: the partial unique index on
 *     access_logs(token_id) WHERE granted rejects a second grant, so a
 *     screenshot of the QR cannot let a second person in within the TTL.
 */
export async function decideGateEntry(token: string, gateId: string | null): Promise<GateDecision> {
  const db = getDb();

  const verified = await verifyAccessToken(token);
  if (!verified.ok) {
    await db.insert(accessLogs).values({ gateId, granted: false, reason: verified.reason });
    return { granted: false, reason: verified.reason };
  }

  const eligibility = await checkAccessEligibility(verified.userId);
  if (!eligibility.eligible) {
    await db.insert(accessLogs).values({
      userId: eligibility.reason === "user_not_found" ? null : verified.userId,
      tokenId: verified.tokenId,
      gateId,
      granted: false,
      reason: eligibility.reason,
    });
    return { granted: false, reason: eligibility.reason };
  }

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
    return { granted: false, reason: "token_already_used" };
  }

  return {
    granted: true,
    userId: verified.userId,
    firstName: eligibility.firstName,
    fullName: eligibility.fullName,
  };
}
