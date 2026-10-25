import { LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/dashboard/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminNav } from "./admin-nav";

// Static chrome only: each page checks requireStaff()/requireAdmin() inside its
// own Suspense boundary, so the layout never blocks on the session.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" aria-label="Yönetim paneli">
              <BrandLogo />
            </Link>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Yönetim
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
            >
              <LayoutDashboard /> <span className="hidden sm:inline">Üye paneli</span>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut /> <span className="hidden sm:inline">Çıkış</span>
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
