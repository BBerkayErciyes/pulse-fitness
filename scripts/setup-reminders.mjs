// Points the Supabase pg_cron reminder job (drizzle/0009) at a deployed app.
// The URL and shared secret are stored in Supabase Vault, never in migrations.
//
// Usage:
//   node scripts/setup-reminders.mjs --url https://your-domain.com   # store URL + CRON_SECRET in Vault
//   node scripts/setup-reminders.mjs --status                        # job, last runs, last HTTP responses
//   node scripts/setup-reminders.mjs --run                           # trigger the job once, now
//
// CRON_SECRET comes from .env.local and must equal the CRON_SECRET env var of
// the deployed app (e.g. Vercel → Settings → Environment Variables).
import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

const args = process.argv.slice(2);
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : null;
const mode = urlArg ? "set" : args.includes("--run") ? "run" : args.includes("--status") ? "status" : null;
if (!mode) {
  console.error("Usage: node scripts/setup-reminders.mjs --url <https://app> | --status | --run");
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, { max: 1, onnotice: (n) => console.log(n.message) });

async function upsertSecret(name, value, description) {
  const [existing] = await sql`SELECT id FROM vault.secrets WHERE name = ${name}`;
  if (existing) await sql`SELECT vault.update_secret(${existing.id}, ${value})`;
  else await sql`SELECT vault.create_secret(${value}, ${name}, ${description})`;
}

try {
  if (mode === "set") {
    const url = new URL(urlArg);
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Use an https:// URL");
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) throw new Error("Set CRON_SECRET (min 32 chars) in .env.local first");
    await upsertSecret("pulse_app_url", url.origin, "Base URL for the reminder cron job");
    await upsertSecret("pulse_cron_secret", secret, "Bearer token for /api/cron/reminders");
    console.log(`Reminder job now calls ${url.origin}/api/cron/reminders daily at 06:00 UTC (09:00 Istanbul).`);
  } else if (mode === "run") {
    const [{ request_id }] = await sql`SELECT public.run_subscription_reminders() AS request_id`;
    console.log(request_id ? `Queued HTTP request #${request_id}; see --status in a few seconds.` : "Not configured; nothing sent.");
  } else {
    console.table(await sql`SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'pulse-subscription-reminders'`);
    const configured = await sql`SELECT name FROM vault.secrets WHERE name IN ('pulse_app_url', 'pulse_cron_secret')`;
    console.log(`Vault secrets set: ${configured.map((r) => r.name).join(", ") || "none"}`);
    console.table(await sql`
      SELECT d.start_time, d.status, left(d.return_message, 80) AS message
      FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
      WHERE j.jobname = 'pulse-subscription-reminders' ORDER BY d.start_time DESC LIMIT 5`);
    console.table(await sql`
      SELECT id, status_code, left(content::text, 120) AS body, created
      FROM net._http_response ORDER BY created DESC LIMIT 5`);
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
