import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const ADMIN_PREFIX = "/admin";

// Refreshes the Supabase session cookie on every page request (Server
// Components cannot write cookies) and gates protected pages. The admin check
// here is only an optimistic redirect; /admin pages re-verify with requireAdmin().
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const isSignedIn = Boolean(userId);
  const { pathname } = request.nextUrl;

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (userId && pathname.startsWith(ADMIN_PREFIX)) {
    // RLS lets a user read their own row; `role` is not in the JWT, so a
    // demotion takes effect immediately instead of at token refresh.
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  // Setting a new password needs the recovery session from /auth/confirm.
  if (!isSignedIn && pathname === "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/forgot-password";
    url.search = "?error=link_invalid";
    return NextResponse.redirect(url);
  }
  if (isSignedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and machine-to-machine endpoints (Stripe, gate hardware).
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/access/validate|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
