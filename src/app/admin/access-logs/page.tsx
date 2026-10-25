import { CheckCircle2, DoorOpen, X, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/admin/auth";
import {
  ACCESS_LOGS_PAGE_SIZE,
  getMemberName,
  listAccessLogs,
  parsePage,
  parseResultFilter,
  type AccessResultFilter,
} from "@/lib/admin/queries";
import { ADMIN_ACCESS_REASON_LABELS } from "@/lib/subscriptions/labels";
import { cn } from "@/lib/utils";
import { firstParam, formatDateTime, fullName } from "../format";
import { Pagination } from "../pagination";

export const metadata: Metadata = { title: "Yönetim · Geçiş Kayıtları", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESULT_TABS: { value: AccessResultFilter | null; label: string }[] = [
  { value: null, label: "Tümü" },
  { value: "granted", label: "Giriş yapıldı" },
  { value: "denied", label: "Reddedildi" },
];

export default function AccessLogsPage({ searchParams }: PageProps<"/admin/access-logs">) {
  return (
    <>
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Geçiş kayıtları</h1>
        <p className="text-sm text-muted-foreground">Turnike QR okutmaları, en yenisi üstte</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Turnike geçmişi</CardTitle>
          <CardDescription>Saatler İstanbul saatine göredir</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<LogsSkeleton />}>
            <AccessLogs searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function AccessLogs({ searchParams }: Pick<PageProps<"/admin/access-logs">, "searchParams">) {
  await requireStaff("/admin/access-logs");
  const params = await searchParams;
  const result = parseResultFilter(firstParam(params.result));
  const member = firstParam(params.member);
  const userId = member && UUID_RE.test(member) ? member : null;
  const page = parsePage(firstParam(params.page));

  const [{ rows, total }, memberName] = await Promise.all([
    listAccessLogs({ result, userId, page }),
    userId ? getMemberName(userId) : null,
  ]);

  const tabHref = (value: AccessResultFilter | null) => {
    const search = new URLSearchParams();
    if (value) search.set("result", value);
    if (userId) search.set("member", userId);
    const qs = search.toString();
    return qs ? `/admin/access-logs?${qs}` : "/admin/access-logs";
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Sonuç filtresi" className="inline-flex rounded-lg bg-muted p-0.5">
          {RESULT_TABS.map(({ value, label }) => (
            <Link
              key={label}
              href={tabHref(value)}
              aria-current={result === value ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                result === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        {userId && (
          <Link
            href={result ? `/admin/access-logs?result=${result}` : "/admin/access-logs"}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            title="Üye filtresini kaldır"
          >
            Üye: {memberName ?? "Silinmiş üye"} <X />
          </Link>
        )}
        <p className="ml-auto text-sm text-muted-foreground tabular-nums">{total} kayıt</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
      ) : (
        <div className="relative -mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Zaman</th>
                <th scope="col" className="py-2 pr-4 font-medium">Üye</th>
                <th scope="col" className="py-2 pr-4 font-medium">Sonuç</th>
                <th scope="col" className="py-2 font-medium">Turnike</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums">
                    <time dateTime={log.createdAt.toISOString()}>{formatDateTime(log.createdAt)}</time>
                  </td>
                  <td className="py-2.5 pr-4">
                    {log.userId ? (
                      <Link
                        href={`/admin/access-logs?member=${log.userId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {log.firstName === null ? "Silinmiş üye" : fullName(log.firstName, log.lastName)}
                      </Link>
                    ) : (
                      // Token could not be read (expired / forged), so no member is known.
                      <span className="text-muted-foreground">Bilinmiyor</span>
                    )}
                    {log.email && <div className="text-xs text-muted-foreground">{log.email}</div>}
                  </td>
                  <td className="py-2.5 pr-4">
                    {log.granted && log.reason === "manual_bypass" ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-success">
                          <DoorOpen className="size-4" /> Manuel geçiş
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {log.actorFirstName !== null ? fullName(log.actorFirstName, log.actorLastName) : "Silinmiş personel"}
                          {log.note && ` · ${log.note}`}
                        </div>
                      </div>
                    ) : log.granted ? (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="size-4" /> Giriş yapıldı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-destructive">
                        <XCircle className="size-4" />
                        {(log.reason && ADMIN_ACCESS_REASON_LABELS[log.reason]) ?? log.reason ?? "Reddedildi"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{log.gateId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        pathname="/admin/access-logs"
        params={{ result, member: userId }}
        page={page}
        pageSize={ACCESS_LOGS_PAGE_SIZE}
        total={total}
      />
    </>
  );
}

function LogsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-8 w-72" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
