import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptionReminders } from "@/db/schema";
import { sendEmail } from "@/lib/email/resend";
import { getPlanInfo } from "@/lib/subscriptions/dashboard";
import { renderReminder, type ReminderKind } from "./templates";

export const REMINDER_LEAD_DAYS = 3;

interface Candidate {
  subscriptionId: string;
  kind: ReminderKind;
  periodEnd: Date;
  /** Exact DB value (microseconds), written back as-is so the ledger matches. */
  periodEndRaw: string;
  planId: string;
  firstName: string;
  email: string;
}

/**
 * Who should get a reminder now, at most once per subscription, kind and
 * billing period:
 *  - renewal:  active, renews within REMINDER_LEAD_DAYS
 *  - ending:   active but set to cancel, ends within REMINDER_LEAD_DAYS
 *  - past_due: payment failed; once per period, as soon as it is seen
 * A window (not an exact day) means a missed daily run still sends next time.
 * Frozen (paused) and canceled subscriptions get nothing.
 */
export async function findReminderCandidates(): Promise<Candidate[]> {
  const rows = await getDb().execute<{
    subscription_id: string;
    kind: ReminderKind;
    period_end_epoch: number | string;
    period_end_raw: string;
    plan_id: string;
    first_name: string;
    email: string | null;
  }>(sql`
    WITH due AS (
      SELECT s.id, s.plan_id, s.user_id, s.current_period_end,
             CASE
               WHEN s.status = 'past_due' THEN 'past_due'
               WHEN s.cancel_at_period_end THEN 'ending'
               ELSE 'renewal'
             END AS kind
      FROM public.subscriptions s
      WHERE s.status = 'past_due'
         OR (s.status = 'active'
             AND s.current_period_end > now()
             AND s.current_period_end <= now() + make_interval(days => ${REMINDER_LEAD_DAYS}))
    )
    SELECT due.id AS subscription_id, due.kind,
           extract(epoch FROM due.current_period_end)::float8 AS period_end_epoch,
           due.current_period_end::text AS period_end_raw, due.plan_id,
           u.first_name, a.email
    FROM due
    JOIN public.users u ON u.id = due.user_id
    JOIN auth.users a ON a.id = due.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscription_reminders r
      WHERE r.subscription_id = due.id AND r.kind = due.kind AND r.period_end = due.current_period_end
    )
    ORDER BY due.current_period_end
  `);

  return rows
    .filter((r) => r.email)
    .map((r) => ({
      subscriptionId: r.subscription_id,
      kind: r.kind,
      // Epoch seconds: unambiguous, unlike Postgres' timestamptz text format.
      periodEnd: new Date(Number(r.period_end_epoch) * 1000),
      periodEndRaw: r.period_end_raw,
      planId: r.plan_id,
      firstName: r.first_name,
      email: r.email!,
    }));
}

export interface ReminderRunResult {
  dryRun: boolean;
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  items: { subscriptionId: string; kind: ReminderKind; status: "sent" | "skipped" | "failed" | "would_send"; error?: string }[];
}

export async function runReminders({ dryRun, appUrl }: { dryRun: boolean; appUrl: string }): Promise<ReminderRunResult> {
  const candidates = await findReminderCandidates();
  const result: ReminderRunResult = { dryRun, candidates: candidates.length, sent: 0, skipped: 0, failed: 0, items: [] };
  const db = getDb();

  for (const c of candidates) {
    if (dryRun) {
      result.items.push({ subscriptionId: c.subscriptionId, kind: c.kind, status: "would_send" });
      continue;
    }

    // Claim first: the unique index makes concurrent or repeated runs skip
    // this reminder instead of sending it twice.
    const [claim] = await db
      .insert(subscriptionReminders)
      .values({ subscriptionId: c.subscriptionId, kind: c.kind, periodEnd: sql`${c.periodEndRaw}::timestamptz` })
      .onConflictDoNothing()
      .returning({ id: subscriptionReminders.id });
    if (!claim) {
      result.skipped++;
      result.items.push({ subscriptionId: c.subscriptionId, kind: c.kind, status: "skipped" });
      continue;
    }

    const plan = await getPlanInfo(c.planId);
    const email = renderReminder(c.kind, {
      firstName: c.firstName,
      planName: plan.name,
      price: plan.price,
      periodEnd: c.periodEnd,
      dashboardUrl: `${appUrl}/dashboard`,
    });
    const sent = await sendEmail({
      to: c.email,
      ...email,
      idempotencyKey: `reminder-${c.kind}-${c.subscriptionId}-${c.periodEnd.getTime()}`,
    });

    if (sent.ok) {
      await db.update(subscriptionReminders).set({ providerMessageId: sent.id }).where(eq(subscriptionReminders.id, claim.id));
      result.sent++;
      result.items.push({ subscriptionId: c.subscriptionId, kind: c.kind, status: "sent" });
    } else {
      // Release the claim so tomorrow's run retries.
      await db
        .delete(subscriptionReminders)
        .where(and(eq(subscriptionReminders.id, claim.id), sql`${subscriptionReminders.providerMessageId} IS NULL`));
      console.error(`[reminders] ${c.kind} for ${c.subscriptionId} failed: ${sent.error}`);
      result.failed++;
      result.items.push({ subscriptionId: c.subscriptionId, kind: c.kind, status: "failed", error: sent.error });
    }
  }
  return result;
}
