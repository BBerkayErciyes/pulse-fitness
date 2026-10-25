import { History } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { AdminMemberRow } from "@/lib/admin/queries";
import { getPlanInfo } from "@/lib/subscriptions/dashboard";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, fullName } from "./format";

export async function MembersTable({ rows }: { rows: AdminMemberRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">Üye bulunamadı.</p>;
  }

  // A handful of distinct prices at most; getPlanInfo is request-memoized.
  const planIds = [...new Set(rows.flatMap((r) => (r.planId ? [r.planId] : [])))];
  const plans = new Map(await Promise.all(planIds.map(async (id) => [id, (await getPlanInfo(id)).name] as const)));

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">Üye</th>
            <th scope="col" className="py-2 pr-4 font-medium">Telefon</th>
            <th scope="col" className="py-2 pr-4 font-medium">Durum</th>
            <th scope="col" className="py-2 pr-4 font-medium">Paket</th>
            <th scope="col" className="py-2 pr-4 font-medium">Dönem sonu</th>
            <th scope="col" className="py-2 pr-4 font-medium">Son giriş</th>
            <th scope="col" className="py-2 pr-4 font-medium">Kayıt</th>
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">İşlemler</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((m) => (
            <tr key={m.id} className="align-middle">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2 font-medium">
                  {fullName(m.firstName, m.lastName)}
                  {m.role === "admin" && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      Admin
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{m.email ?? "—"}</div>
              </td>
              <td className="py-3 pr-4 tabular-nums text-muted-foreground">{m.phone ?? "—"}</td>
              <td className="py-3 pr-4">
                {m.status ? (
                  <div className="space-y-1">
                    <StatusBadge status={m.status} />
                    {m.cancelAtPeriodEnd && m.status !== "canceled" && (
                      <p className="text-xs text-muted-foreground">Dönem sonunda bitecek</p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Üyelik yok</span>
                )}
              </td>
              <td className="py-3 pr-4">{m.planId ? plans.get(m.planId) : "—"}</td>
              <td className="py-3 pr-4 tabular-nums">{m.currentPeriodEnd ? formatDate(m.currentPeriodEnd) : "—"}</td>
              <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                {m.lastVisitAt ? (
                  <time dateTime={m.lastVisitAt.toISOString()}>{formatDateTime(m.lastVisitAt)}</time>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-3 pr-4 tabular-nums text-muted-foreground">{formatDate(m.joinedAt)}</td>
              <td className="py-3 text-right">
                <Link
                  href={`/admin/access-logs?member=${m.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
                  title="Geçiş geçmişi"
                >
                  <History /> <span className="sr-only lg:not-sr-only">Geçişler</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
