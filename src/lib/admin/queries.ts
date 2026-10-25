import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { authUsers as authUsersTable } from "drizzle-orm/supabase";
import { getDb } from "@/db";
import { accessLogs, subscriptions, subscriptionStatus, users, type SubscriptionStatus } from "@/db/schema";

// Every query here goes through Drizzle as the postgres owner (bypassing RLS),
// so callers must have passed requireAdmin() first.

export const MEMBERS_PAGE_SIZE = 25;
export const ACCESS_LOGS_PAGE_SIZE = 50;

export type MemberStatusFilter = SubscriptionStatus | "none";
export type AccessResultFilter = "granted" | "denied";

export function parseStatusFilter(value: unknown): MemberStatusFilter | null {
  if (value === "none") return "none";
  return subscriptionStatus.enumValues.find((s) => s === value) ?? null;
}

export function parseResultFilter(value: unknown): AccessResultFilter | null {
  return value === "granted" || value === "denied" ? value : null;
}

export function parsePage(value: unknown): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

// public.users and auth.users share a name, so joining both needs an alias.
const authUsers = alias(authUsersTable, "auth_users");

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

// Start of "today" in the gym's timezone, evaluated by the database.
const startOfToday = sql`(date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')`;

// One row per user: the live subscription if any, otherwise the most recent
// ended one — the same rule the member dashboard uses.
function currentSubscriptions() {
  return getDb()
    .selectDistinctOn([subscriptions.userId], {
      userId: subscriptions.userId,
      status: subscriptions.status,
      planId: subscriptions.planId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .orderBy(subscriptions.userId, sql`${subscriptions.status} = 'canceled'`, desc(subscriptions.createdAt))
    .as("current_sub");
}

export async function getAdminOverview() {
  const db = getDb();
  const current = currentSubscriptions();

  const [byStatus, [members], [today]] = await Promise.all([
    db.select({ status: current.status, total: count() }).from(current).groupBy(current.status),
    db.select({ total: count() }).from(users).where(eq(users.role, "member")),
    db
      .select({
        granted: count(sql`CASE WHEN ${accessLogs.granted} THEN 1 END`),
        denied: count(sql`CASE WHEN NOT ${accessLogs.granted} THEN 1 END`),
      })
      .from(accessLogs)
      .where(sql`${accessLogs.createdAt} >= ${startOfToday}`),
  ]);

  const statusCounts = Object.fromEntries(subscriptionStatus.enumValues.map((s) => [s, 0])) as Record<
    SubscriptionStatus,
    number
  >;
  for (const row of byStatus) statusCounts[row.status] = row.total;

  return {
    totalMembers: members?.total ?? 0,
    statusCounts,
    todayGranted: today?.granted ?? 0,
    todayDenied: today?.denied ?? 0,
  };
}

export async function listMembers({
  query,
  status,
  page,
}: {
  query: string | null;
  status: MemberStatusFilter | null;
  page: number;
}) {
  const db = getDb();
  const current = currentSubscriptions();

  const filters: (SQL | undefined)[] = [];
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    filters.push(
      or(
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
        ilike(sql`${users.firstName} || ' ' || ${users.lastName}`, pattern),
        ilike(authUsers.email, pattern),
        ilike(users.phone, pattern),
      ),
    );
  }
  if (status === "none") filters.push(isNull(current.status));
  else if (status) filters.push(eq(current.status, status));
  const where = and(...filters);

  const base = db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: authUsers.email,
      phone: users.phone,
      role: users.role,
      joinedAt: users.createdAt,
      status: current.status,
      planId: current.planId,
      currentPeriodEnd: current.currentPeriodEnd,
      cancelAtPeriodEnd: current.cancelAtPeriodEnd,
      // Served by access_logs_user_id_created_at_idx.
      lastVisitAt: sql<Date | null>`(
        SELECT max(${accessLogs.createdAt}) FROM ${accessLogs}
        WHERE ${accessLogs.userId} = ${users.id} AND ${accessLogs.granted}
      )`.mapWith((v: string | null) => (v === null ? null : new Date(v))),
    })
    .from(users)
    .innerJoin(authUsers, eq(authUsers.id, users.id))
    .leftJoin(current, eq(current.userId, users.id));

  const [rows, [total]] = await Promise.all([
    base
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(MEMBERS_PAGE_SIZE)
      .offset((page - 1) * MEMBERS_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(users)
      .innerJoin(authUsers, eq(authUsers.id, users.id))
      .leftJoin(current, eq(current.userId, users.id))
      .where(where),
  ]);

  return { rows, total: total?.total ?? 0 };
}

export async function listAccessLogs({
  result,
  userId,
  page,
}: {
  result: AccessResultFilter | null;
  userId: string | null;
  page: number;
}) {
  const db = getDb();
  const where = and(
    result ? eq(accessLogs.granted, result === "granted") : undefined,
    userId ? eq(accessLogs.userId, userId) : undefined,
  );

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: accessLogs.id,
        createdAt: accessLogs.createdAt,
        granted: accessLogs.granted,
        reason: accessLogs.reason,
        gateId: accessLogs.gateId,
        userId: accessLogs.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: authUsers.email,
      })
      .from(accessLogs)
      .leftJoin(users, eq(users.id, accessLogs.userId))
      .leftJoin(authUsers, eq(authUsers.id, accessLogs.userId))
      .where(where)
      .orderBy(desc(accessLogs.createdAt))
      .limit(ACCESS_LOGS_PAGE_SIZE)
      .offset((page - 1) * ACCESS_LOGS_PAGE_SIZE),
    db.select({ total: count() }).from(accessLogs).where(where),
  ]);

  return { rows, total: total?.total ?? 0 };
}

/** Name for the "filtered by member" chip on the access log view. */
export async function getMemberName(userId: string) {
  const [row] = await getDb()
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId));
  return row ? `${row.firstName} ${row.lastName}`.trim() || "İsimsiz üye" : null;
}

export type AdminMemberRow = Awaited<ReturnType<typeof listMembers>>["rows"][number];
export type AdminAccessLogRow = Awaited<ReturnType<typeof listAccessLogs>>["rows"][number];
