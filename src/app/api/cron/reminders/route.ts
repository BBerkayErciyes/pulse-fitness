import { createHash, timingSafeEqual } from "node:crypto";
import { isEmailConfigured } from "@/lib/email/resend";
import { runReminders } from "@/lib/reminders/run";

/**
 * Daily subscription reminders. Called by the Supabase pg_cron job
 * `pulse-subscription-reminders` (drizzle/0009) through pg_net:
 *
 *   POST /api/cron/reminders            Authorization: Bearer <CRON_SECRET>
 *   POST /api/cron/reminders?dry_run=1  lists who would be e-mailed, sends nothing
 *
 * Safe to call repeatedly: each reminder is claimed in subscription_reminders
 * before sending, so it goes out at most once per billing period.
 */

const HEADERS = { "Cache-Control": "no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[reminders] CRON_SECRET is not set");
    return Response.json({ error: "not_configured" }, { status: 503, headers: HEADERS });
  }
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!provided || !timingSafeEqual(digest(provided), digest(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }

  const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
  if (!dryRun && !isEmailConfigured()) {
    console.error("[reminders] RESEND_API_KEY / EMAIL_FROM_ADDRESS are not set");
    return Response.json({ error: "email_not_configured" }, { status: 503, headers: HEADERS });
  }

  const appUrl = (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const result = await runReminders({ dryRun, appUrl });
  console.info(
    `[reminders] ${dryRun ? "dry run" : "run"}: ${result.candidates} due, ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`,
  );
  return Response.json(result, { status: result.failed > 0 ? 207 : 200, headers: HEADERS });
}
