import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo />
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
