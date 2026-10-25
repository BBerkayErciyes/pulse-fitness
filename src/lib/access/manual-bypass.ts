import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accessLogs } from "@/db/schema";
import { checkAccessEligibility } from "./eligibility";

export const MANUAL_GATE_ID = "manual";
export const MANUAL_NOTE_MAX_LENGTH = 200;
// A second manual entry for the same member this soon is almost certainly a
// double click, not a second visit.
const DUPLICATE_WINDOW_SECONDS = 60;

export type ManualBypassResult =
  | { ok: true; fullName: string }
  | { ok: false; reason: "user_not_found" | "not_eligible" | "duplicate"; detail?: string };

/**
 * Records a staff-initiated entry (broken turnstile, forgotten phone). Same
 * subscription rule as the gate: only members who could enter with a QR may
 * be let in by hand. Logged as granted with reason "manual_bypass", the
 * acting staff member and an optional note.
 *
 * This only writes the audit record; the turnstile itself is opened by staff
 * on site (there is no server -> gate command channel).
 */
export async function recordManualBypass(input: {
  userId: string;
  actorId: string;
  note: string | null;
}): Promise<ManualBypassResult> {
  const eligibility = await checkAccessEligibility(input.userId);
  if (!eligibility.eligible) {
    if (eligibility.reason === "user_not_found") return { ok: false, reason: "user_not_found" };
    return { ok: false, reason: "not_eligible", detail: eligibility.reason };
  }

  const db = getDb();
  const [recent] = await db
    .select({ id: accessLogs.id })
    .from(accessLogs)
    .where(
      and(
        eq(accessLogs.userId, input.userId),
        eq(accessLogs.granted, true),
        gt(accessLogs.createdAt, sql`now() - make_interval(secs => ${DUPLICATE_WINDOW_SECONDS})`),
      ),
    )
    .limit(1);
  if (recent) return { ok: false, reason: "duplicate" };

  await db.insert(accessLogs).values({
    userId: input.userId,
    granted: true,
    reason: "manual_bypass",
    gateId: MANUAL_GATE_ID,
    actorId: input.actorId,
    note: input.note?.trim().slice(0, MANUAL_NOTE_MAX_LENGTH) || null,
  });
  return { ok: true, fullName: eligibility.fullName };
}
