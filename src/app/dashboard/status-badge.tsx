import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/subscriptions/labels";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: "bg-success/15 text-success",
  past_due: "bg-warning/20 text-warning",
  paused: "bg-muted text-muted-foreground",
  canceled: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge className={cn("gap-1.5 font-medium", STATUS_STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
