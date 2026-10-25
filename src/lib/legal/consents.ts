import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { userConsents } from "@/db/schema";
import { LEGAL_DOCUMENTS, type LegalDocument } from "./documents";

export interface ConsentEvidence {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Documents whose current version the user has not accepted yet. */
export async function getMissingConsents(userId: string): Promise<LegalDocument[]> {
  const accepted = await getDb()
    .select({ document: userConsents.document, version: userConsents.version })
    .from(userConsents)
    .where(
      and(
        eq(userConsents.userId, userId),
        inArray(
          userConsents.document,
          LEGAL_DOCUMENTS.map((d) => d.id),
        ),
      ),
    );
  const have = new Set(accepted.map((a) => `${a.document}@${a.version}`));
  return LEGAL_DOCUMENTS.filter((d) => !have.has(`${d.id}@${d.version}`));
}

export async function hasAllConsents(userId: string): Promise<boolean> {
  return (await getMissingConsents(userId)).length === 0;
}

/**
 * Stores acceptance of the given documents' current versions. The timestamp
 * is set by the database (accepted_at DEFAULT now()), never by the client.
 * Re-accepting the same version is a no-op, keeping the first timestamp.
 */
export async function recordConsents(userId: string, documents: readonly LegalDocument[], evidence: ConsentEvidence) {
  if (documents.length === 0) return;
  await getDb()
    .insert(userConsents)
    .values(
      documents.map((d) => ({
        userId,
        document: d.id,
        version: d.version,
        ipAddress: evidence.ipAddress?.slice(0, 64) ?? null,
        userAgent: evidence.userAgent?.slice(0, 512) ?? null,
      })),
    )
    .onConflictDoNothing();
}

/** Client IP and user agent from request headers (Vercel sets x-forwarded-for). */
export function evidenceFromHeaders(headers: Headers): ConsentEvidence {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || headers.get("x-real-ip") || null,
    userAgent: headers.get("user-agent"),
  };
}
