import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Activity className="size-5" strokeWidth={2.5} />
      </span>
      <span className="text-lg">
        Pulse<span className="text-primary">Fitness</span>
      </span>
    </span>
  );
}
