// End-to-end gate simulation against a running app (default http://localhost:3000).
// Usage: node scripts/simulate-gate.mjs [baseUrl]
//
// Creates a throwaway Supabase auth user, drives /api/access/generate and
// /api/access/validate through every scenario, then deletes everything it made.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { SignJWT } from "jose";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

const BASE = process.argv[2] ?? "http://localhost:3000";
const GATE_ID = "sim-gate";
const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const anon = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
});
const sql = postgres(process.env.DIRECT_URL ?? env("DATABASE_URL"), { max: 1, onnotice() {} });

let failures = 0;
function check(label, actual, expected) {
  const ok = Object.entries(expected).every(([k, v]) => actual[k] === v);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, ok ? "" : `\n      got ${JSON.stringify(actual)}`);
}

async function call(path, { bearer, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

const gateKey = env("GATE_API_KEY");
const validate = (token, key = gateKey) =>
  call("/api/access/validate", { bearer: key, body: { token, gate_id: GATE_ID } });

async function setSubscription(userId, status) {
  await sql`delete from subscriptions where user_id = ${userId}`;
  if (!status) return;
  await sql`
    insert into subscriptions (user_id, stripe_subscription_id, plan_id, status,
      current_period_start, current_period_end, canceled_at)
    values (${userId}, ${"sub_sim_" + randomUUID()}, 'price_sim', ${status},
      now(), now() + interval '1 month', ${status === "canceled" ? new Date() : null})`;
}

const email = `gate-sim-${Date.now()}@example.com`;
const password = randomUUID();
let userId;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Sim", last_name: "Member" },
  });
  if (createError) throw createError;
  userId = created.user.id;

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const accessToken = signIn.session.access_token;
  const generate = () => call("/api/access/generate", { bearer: accessToken });

  console.log(`Simulating against ${BASE} as ${email}\n`);

  // --- generate: security layer ---
  check("generate without login → 401", await call("/api/access/generate"), { status: 401 });
  await setSubscription(userId, null);
  check("generate, no subscription → 403", await generate(), { status: 403, error: "no_subscription" });
  await setSubscription(userId, "paused");
  check("generate, paused → 403", await generate(), { status: 403, error: "subscription_paused" });
  await setSubscription(userId, "past_due");
  check("generate, past_due (grace) → 200", await generate(), { status: 200 });

  // --- validate: happy path + replay ---
  await setSubscription(userId, "active");
  const issued = await generate();
  check("generate, active → 200 + token", { ...issued, hasToken: !!issued.token }, { status: 200, hasToken: true });
  check("validate fresh token → access", await validate(issued.token), { access: true, user: "Sim Member" });
  check("validate same token again → replay blocked", await validate(issued.token), {
    access: false,
    reason: "token_already_used",
  });

  // --- validate: gate auth + bad tokens ---
  const another = await generate();
  check("validate with wrong gate key → 401", await validate(another.token, "wrong-key"), { status: 401 });
  check("validate tampered token → invalid", await validate(another.token.slice(0, -2) + "xx"), {
    access: false,
    reason: "invalid_token",
  });
  const secret = new TextEncoder().encode(env("ACCESS_TOKEN_SECRET"));
  const expired = await new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer("pulse-fitness")
    .setAudience("pulse-gate")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 30)
    .sign(secret);
  check("validate expired token (TTL passed) → denied", await validate(expired), {
    access: false,
    reason: "token_expired",
  });

  // --- validate: subscription changed after the QR was issued ---
  const beforeCancel = await generate();
  await setSubscription(userId, "canceled");
  check("validate after cancel (final DB check) → denied", await validate(beforeCancel.token), {
    access: false,
    reason: "no_subscription",
  });

  const logs = await sql`select granted, reason from access_logs where user_id = ${userId} or gate_id = ${GATE_ID}`;
  console.log(`\naccess_logs written: ${logs.length} (${logs.filter((l) => l.granted).length} granted)`);
} finally {
  await sql`delete from access_logs where gate_id = ${GATE_ID}`;
  if (userId) await admin.auth.admin.deleteUser(userId); // cascades users + subscriptions
  await sql.end();
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL GATE CHECKS PASSED");
process.exitCode = failures ? 1 : 0;
