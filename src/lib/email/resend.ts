// Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email).
// Server-only: needs RESEND_API_KEY and EMAIL_FROM_ADDRESS.

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend de-duplicates sends with the same key for 24 hours. */
  idempotencyKey: string;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM_ADDRESS);
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !fromAddress) return { ok: false, error: "email_not_configured" };
  const fromName = process.env.EMAIL_FROM_NAME || "Pulse Fitness";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok || !body.id) return { ok: false, error: `${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim() };
    return { ok: true, id: body.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
