import { AlertTriangle, CheckCircle2, ScanLine, Users, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export async function OverviewStats() {
  await requireStaff();
  const { totalMembers, statusCounts, todayGranted, todayDenied } = await getAdminOverview();

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Toplam üye" value={totalMembers} icon={Users} />
      <Stat label="Aktif" value={statusCounts.active} icon={CheckCircle2} tone="text-success" href="/admin?status=active" />
      <Stat
        label="Ödeme gecikti"
        value={statusCounts.past_due}
        icon={AlertTriangle}
        tone="text-warning"
        href="/admin?status=past_due"
      />
      <Stat
        label="İptal edildi"
        value={statusCounts.canceled}
        icon={XCircle}
        tone="text-destructive"
        href="/admin?status=canceled"
      />
      <Stat
        label="Bugünkü girişler"
        value={todayGranted}
        icon={ScanLine}
        tone="text-primary"
        href="/admin/access-logs"
        hint={todayDenied > 0 ? `${todayDenied} reddedildi` : undefined}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "text-muted-foreground",
  href,
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <Card size="sm" className={cn("h-full gap-2 px-4", href && "transition-colors hover:bg-muted/60")}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <Icon className={cn("size-4", tone)} />
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString("tr-TR")}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
