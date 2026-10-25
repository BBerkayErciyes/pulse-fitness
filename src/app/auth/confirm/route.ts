import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Link types this app sends: password recovery and signup confirmation.
const ALLOWED_TYPES = new Set<EmailOtpType>(["recovery", "email", "signup"]);

// Only same-origin paths, never "//evil.com" style protocol-relative URLs.
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/**
 * Landing point for Supabase email links. Supports both link styles:
 * - `?token_hash=…&type=…` — works on any device (the request and the click
 *   can happen in different browsers). Our templates in supabase/templates
 *   use this; apply them with `npm run auth:configure`.
 * - `?code=…` — Supabase's default PKCE link; only works in the browser that
 *   started the flow, because the code verifier lives in its cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createSupabaseServerClient();
  let ok = false;
  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  if (ok) {
    return NextResponse.redirect(new URL(next, origin));
  }
  // Send the member somewhere they can retry the flow they were in.
  const isRecovery = type === "recovery" || next === "/reset-password";
  const retry = isRecovery ? "/forgot-password?error=link_invalid" : "/login?error=link_invalid";
  return NextResponse.redirect(new URL(retry, origin));
}
