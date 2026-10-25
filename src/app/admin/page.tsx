import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { subscriptionStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { listMembers, MEMBERS_PAGE_SIZE, parsePage, parseStatusFilter } from "@/lib/admin/queries";
import { STATUS_LABELS } from "@/lib/subscriptions/labels";
import { cn } from "@/lib/utils";
import { AnalyticsSection } from "./analytics-section";
import { firstParam } from "./format";
import { MembersTable } from "./members-table";
import { OverviewStats } from "./overview-stats";
import { Pagination } from "./pagination";

export const metadata: Metadata = { title: "Yönetim · Üyeler", robots: { index: false, follow: false } };

export default function AdminMembersPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Genel bakış</h1>
        <p className="text-sm text-muted-foreground">Üyeler, abonelik durumları ve bugünkü turnike hareketleri</p>
      </section>

      <Suspense fallback={<StatsSkeleton />}>
        <OverviewStats />
      </Suspense>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSection />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Üyeler</CardTitle>
          <CardDescription>Kayıtlı tüm kullanıcılar ve güncel abonelikleri</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<TableSkeleton />}>
            <Members searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function Members({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const query = firstParam(params.q)?.slice(0, 100) ?? null;
  const status = parseStatusFilter(firstParam(params.status));
  const page = parsePage(firstParam(params.page));

  const { rows, total } = await listMembers({ query, status, page });
  const filtered = Boolean(query || status);

  return (
    <>
      {/* Plain GET form: filters live in the URL, so views are shareable and work without JS. */}
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            defaultValue={query ?? ""}
            placeholder="İsim, e-posta veya telefon ara"
            aria-label="Üye ara"
            className="h-9 pl-8"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Abonelik durumu"
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Tüm durumlar</option>
          {subscriptionStatus.enumValues.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
          <option value="none">Üyelik yok</option>
        </select>
        <Button type="submit" className="h-9">
          Filtrele
        </Button>
        {filtered && (
          <Link href="/admin" className={cn(buttonVariants({ variant: "ghost" }), "h-9")}>
            Temizle
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground tabular-nums">
        {total} üye{filtered && " filtreyle eşleşti"}
      </p>

      <MembersTable rows={rows} />

      <Pagination
        pathname="/admin"
        params={{ q: query, status }}
        page={page}
        pageSize={MEMBERS_PAGE_SIZE}
        total={total}
      />
    </>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-6 w-28" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
