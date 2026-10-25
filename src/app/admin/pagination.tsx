import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Prev/next links that keep the current filters. `params` are the active
 * search params without `page`.
 */
export function Pagination({
  pathname,
  params,
  page,
  pageSize,
  total,
}: {
  pathname: string;
  params: Record<string, string | null>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <nav aria-label="Sayfalama" className="flex items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground tabular-nums">
        Sayfa {Math.min(page, pageCount)} / {pageCount}
      </p>
      <div className="flex gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(linkClass, page <= 1 && disabledClass)}
        >
          <ChevronLeft /> Önceki
        </Link>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          className={cn(linkClass, page >= pageCount && disabledClass)}
        >
          Sonraki <ChevronRight />
        </Link>
      </div>
    </nav>
  );
}
