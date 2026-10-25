// End-to-end gate simulation against a running app (default http://localhost:3000).
// Usage: node scripts/simulate-gate.mjs [baseUrl]
//
// Creates a throwaway Supabase auth user, drives /api/access/generate,
// /api/access/validate and the hardware endpoint /api/gate/verify through
// every scenario, then deletes everything it made.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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

// Raw call for /api/gate/verify, which accepts JSON or a text/plain scan.
async function gateVerify({ json, text, key = gateKey, header = "bearer", gateId } = {}) {
  const headers = {};
  if (key && header === "bearer") headers.authorization = `Bearer ${key}`;
  if (key && header === "x-gate-key") headers["x-gate-key"] = key;
  if (gateId) headers["x-gate-id"] = gateId;
  let body;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (text !== undefined) {
    headers["content-type"] = "text/plain";
    body = text;
  }
  const res = await fetch(`${BASE}/api/gate/verify`, { method: "POST", headers, body });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

// QR generation requires the current legal consents (Phase 12). Versions are
// read from the source of truth so this script never drifts from the app.
const LEGAL_DOCS = [...readFileSync(new URL("../src/lib/legal/documents.ts", import.meta.url), "utf8")
  .matchAll(/id: "([^"]+)",[\s\S]*?version: "([^"]+)"/g)].map(([, id, version]) => ({ id, version }));

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
  for (const doc of LEGAL_DOCS) {
    await sql`insert into user_consents (user_id, document, version) values (${userId}, ${doc.id}, ${doc.version})`;
  }

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

  // --- /api/gate/verify: hardware endpoint ---
  console.log("\n/api/gate/verify");
  await setSubscription(userId, "active");
  const health = await fetch(`${BASE}/api/gate/verify`, { headers: { authorization: `Bearer ${gateKey}` } });
  check("GET health with key → ok", { status: health.status, ...(await health.json()) }, { status: 200, ok: true });
  check("GET health without key → 401", { status: (await fetch(`${BASE}/api/gate/verify`)).status }, { status: 401 });

  let qr = await generate();
  check("no key → 401 deny", await gateVerify({ json: { token: qr.token }, key: null }), {
    status: 401, action: "deny", reason: "unauthorized",
  });
  check("wrong key → 401 deny", await gateVerify({ json: { token: qr.token }, key: "wrong-key" }), {
    status: 401, action: "deny", reason: "unauthorized",
  });
  check("empty body → 400 deny", await gateVerify({ json: {} }), { status: 400, action: "deny", reason: "bad_request" });

  const opened = await gateVerify({ json: { token: qr.token, gate_id: GATE_ID } });
  check("fresh QR (JSON) → open", opened, { status: 200, action: "open", reason: null });
  check("open message greets by first name only", { ok: opened.message === "Hoş geldin, Sim!" }, { ok: true });
  check("same QR again → deny (replay)", await gateVerify({ json: { token: qr.token, gate_id: GATE_ID } }), {
    action: "deny", reason: "token_already_used",
  });

  // Raw scanner output with trailing CR/LF, X-Gate-Key auth, gate id from header.
  qr = await generate();
  check("raw text/plain scan + X-Gate-Key → open",
    await gateVerify({ text: `${qr.token}\r\n`, header: "x-gate-key", gateId: `${GATE_ID}-raw` }), { action: "open" });
  const [rawLog] = await sql`select granted from access_logs where gate_id = ${GATE_ID + "-raw"}`;
  check("raw scan logged with header gate id", { granted: rawLog?.granted }, { granted: true });

  qr = await generate();
  check("tampered QR → deny invalid_token", await gateVerify({ json: { token: qr.token.slice(0, -2) + "xx", gate_id: GATE_ID } }), {
    action: "deny", reason: "invalid_token",
  });
  check("expired QR → deny token_expired", await gateVerify({ json: { qr: expired, gate_id: GATE_ID } }), {
    action: "deny", reason: "token_expired",
  });
  check("QR from another secret → deny invalid_token", await gateVerify({
    json: { token: await new SignJWT().setProtectedHeader({ alg: "HS256" }).setSubject(userId).setJti(randomUUID())
      .setIssuer("pulse-fitness").setAudience("pulse-gate").setExpirationTime("30s")
      .sign(new TextEncoder().encode("x".repeat(48))), gate_id: GATE_ID },
  }), { action: "deny", reason: "invalid_token" });

  // Subscription changes after the QR was shown: the DB check at the gate wins.
  qr = await generate();
  await setSubscription(userId, "paused");
  check("paused after QR issued → deny", await gateVerify({ json: { token: qr.token, gate_id: GATE_ID } }), {
    action: "deny", reason: "subscription_paused",
  });
  await setSubscription(userId, "past_due");
  check("past_due (grace) → open", await gateVerify({ json: { token: qr.token, gate_id: GATE_ID } }), { action: "open" });
  qr = await generate();
  await setSubscription(userId, null);
  check("no subscription → deny", await gateVerify({ json: { token: qr.token, gate_id: GATE_ID } }), {
    action: "deny", reason: "no_subscription",
  });

  const logs = await sql`select granted, reason from access_logs where user_id = ${userId} or gate_id like ${GATE_ID + "%"}`;
  console.log(`\naccess_logs written: ${logs.length} (${logs.filter((l) => l.granted).length} granted)`);
} finally {
  // Each cleanup step is independent so one failure (e.g. DB unreachable)
  // never leaves the throwaway auth user behind.
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId); // cascades users + subscriptions
    if (error) console.error(`Cleanup: could not delete test user ${email}: ${error.message}`);
  }
  await sql`delete from access_logs where gate_id like ${GATE_ID + "%"}`.catch((err) =>
    console.error(`Cleanup: could not delete ${GATE_ID} access logs: ${err.message}`),
  );
  await sql.end();
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL GATE CHECKS PASSED");
process.exitCode = failures ? 1 : 0;
