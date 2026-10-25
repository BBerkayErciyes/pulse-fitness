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
 * Returns the verified Supabase user id for a request, or null.
 * Accepts `Authorization: Bearer <access_token>` (mobile / API clients) and
 * falls back to the cookie session (web). getClaims() verifies the JWT
 * signature — never trust getSession() for authorization.
 */
export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  const { data, error } = await supabase.auth.getClaims(bearer);
  if (error || !data?.claims.sub) return null;
  return data.claims.sub;
}
