import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PanelRole = Extract<UserRole, "admin" | "staff">;

export interface PanelUser {
  id: string;
  firstName: string;
  role: PanelRole;
}

export const isPanelRole = (role: UserRole | null | undefined): role is PanelRole =>
  role === "admin" || role === "staff";

/**
 * Verified JWT + role read from the database on every request, so it holds
 * even if the proxy is skipped (prefetch, matcher change) or the role was
 * revoked a moment ago. The proxy's check is only an optimistic redirect.
 */
export const getPanelUser = cache(async (): Promise<PanelUser | null | "signed-out"> => {
  // Panel data is always per-request; also keeps getClaims()' expiry check
  // (Date.now) out of prerendering.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return "signed-out";

  const [profile] = await getDb()
    .select({ role: users.role, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId));
  if (!profile || !isPanelRole(profile.role)) return null;
  return { id: userId, firstName: profile.firstName, role: profile.role };
});

/** Page gate for /admin: admins and front-desk staff. */
export async function requireStaff(next = "/admin"): Promise<PanelUser> {
  const user = await getPanelUser();
  if (user === "signed-out") redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!user) redirect("/dashboard");
  return user;
}

/** Page gate for admin-only content (finance, subscription changes). */
export async function requireAdmin(next = "/admin"): Promise<PanelUser> {
  const user = await requireStaff(next);
  if (user.role !== "admin") redirect("/admin");
  return user;
}

/**
 * For Server Actions (public POST endpoints): returns the user or null instead
 * of redirecting, so the action can answer with a message.
 */
export async function authorizeAction(minimum: PanelRole): Promise<PanelUser | null> {
  const user = await getPanelUser();
  if (!user || user === "signed-out") return null;
  if (minimum === "admin" && user.role !== "admin") return null;
  return user;
}
