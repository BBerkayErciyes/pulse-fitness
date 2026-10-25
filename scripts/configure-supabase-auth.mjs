// Configures Supabase Auth email delivery via the Management API:
// Resend as custom SMTP, plus our token_hash email templates (which work when a
// link is opened on a different device than the one that requested it).
//
// Usage:
//   node scripts/configure-supabase-auth.mjs            # dry run: show what would change
//   node scripts/configure-supabase-auth.mjs --apply    # apply it
//   node scripts/configure-supabase-auth.mjs --status   # show the project's current settings
//
// Needs (in .env.local): SUPABASE_ACCESS_TOKEN, RESEND_API_KEY, EMAIL_FROM_ADDRESS,
// optionally EMAIL_FROM_NAME. site_url / redirect URLs are deliberately left
// untouched — they are managed in the dashboard per environment.
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--status") ? "status" : "dry-run";
const API = "https://api.supabase.com/v1";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

const projectRef = new URL(required("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
const accessToken = required("SUPABASE_ACCESS_TOKEN");
const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };

async function getAuthConfig() {
  const res = await fetch(`${API}/projects/${projectRef}/config/auth`, { headers });
  if (!res.ok) throw new Error(`GET auth config failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function summarize(cfg) {
  const usesTokenHash = (tpl) => (tpl ?? "").includes("{{ .TokenHash }}");
  return {
    smtp_host: cfg.smtp_host ?? "(built-in Supabase email)",
    smtp_port: cfg.smtp_port ?? null,
    smtp_user: cfg.smtp_user ?? null,
    smtp_pass: cfg.smtp_pass ? "<set>" : null,
    smtp_admin_email: cfg.smtp_admin_email ?? null,
    smtp_sender_name: cfg.smtp_sender_name ?? null,
    site_url: cfg.site_url,
    recovery_template_cross_device: usesTokenHash(cfg.mailer_templates_recovery_content),
    confirmation_template_cross_device: usesTokenHash(cfg.mailer_templates_confirmation_content),
    rate_limit_email_sent_per_hour: cfg.rate_limit_email_sent,
  };
}

async function main() {
  if (mode === "status") {
    console.log(`Project ${projectRef} auth email settings:`);
    console.table(summarize(await getAuthConfig()));
    return;
  }

  const fromAddress = required("EMAIL_FROM_ADDRESS");
  const resendKey = required("RESEND_API_KEY");
  const template = async (name) => {
    const html = await readFile(new URL(`../supabase/templates/${name}.html`, import.meta.url), "utf8");
    if (!html.includes("{{ .TokenHash }}")) throw new Error(`${name}.html must link with {{ .TokenHash }}`);
    return html;
  };

  const payload = {
    // Resend SMTP: https://resend.com/docs/send-with-smtp
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: resendKey,
    smtp_admin_email: fromAddress,
    smtp_sender_name: process.env.EMAIL_FROM_NAME || "Pulse Fitness",
    mailer_subjects_recovery: "Pulse Fitness şifre sıfırlama",
    mailer_templates_recovery_content: await template("recovery"),
    mailer_subjects_confirmation: "Pulse Fitness hesabını doğrula",
    mailer_templates_confirmation_content: await template("confirmation"),
  };

  if (mode === "dry-run") {
    console.log(`Dry run for project ${projectRef}. Would PATCH /config/auth with:`);
    console.table({
      ...payload,
      smtp_pass: "<RESEND_API_KEY>",
      mailer_templates_recovery_content: `<supabase/templates/recovery.html, ${payload.mailer_templates_recovery_content.length} chars>`,
      mailer_templates_confirmation_content: `<supabase/templates/confirmation.html, ${payload.mailer_templates_confirmation_content.length} chars>`,
    });
    console.log("Run again with --apply to apply.");
    return;
  }

  const res = await fetch(`${API}/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH auth config failed: ${res.status} ${await res.text()}`);
  console.log(`Applied to project ${projectRef}. Current settings:`);
  console.table(summarize(await getAuthConfig()));
}

// exitCode instead of process.exit(): exiting while fetch sockets are still
// closing trips a libuv assertion on Windows.
main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
