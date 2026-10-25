import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  firstName: string;
}

/**
 * Authoritative admin gate for /admin pages and any admin data access. The
 * proxy only redirects optimistically; this re-checks the verified JWT and the
 * role in the database on every request, so it holds even if the proxy is
 * skipped (prefetch, matcher change) or the role was revoked a moment ago.
 */
export const requireAdmin = cache(async (next = "/admin"): Promise<AdminUser> => {
  // Admin data is always per-request; also keeps getClaims()' expiry check
  // (Date.now) out of prerendering.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);

  const [profile] = await getDb()
    .select({ role: users.role, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId));
  if (profile?.role !== "admin") redirect("/dashboard");

  return { id: userId, firstName: profile.firstName };
});
