import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
  }

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only; the
          // session refresh will happen on the next mutable request.
        }
      },
    },
  });
}

/**
 * Returns the verified Supabase user for a request, or null.
 * Accepts `Authorization: Bearer <access_token>` (mobile / API clients) and
 * falls back to the cookie session (web). getClaims() verifies the JWT
 * signature — never trust getSession() for authorization.
 */
export async function getAuthenticatedUser(
  request: Request,
): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  const { data, error } = await supabase.auth.getClaims(bearer);
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub, email: data.claims.email ?? null };
}

export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  return (await getAuthenticatedUser(request))?.id ?? null;
}
