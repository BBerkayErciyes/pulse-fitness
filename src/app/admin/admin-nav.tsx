"use client";

import { ScanLine, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Üyeler", icon: Users },
  { href: "/admin/access-logs", label: "Geçiş Kayıtları", icon: ScanLine },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Yönetim" className="-mb-px flex gap-4">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
