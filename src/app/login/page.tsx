import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

// Only same-origin paths, never "//evil.com" style protocol-relative URLs.
function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

async function LoginFormWithRedirect({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeNext(next)} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo />
          <p className="text-sm text-muted-foreground">Üye paneline giriş yap, QR kodunla salona gir.</p>
        </div>
        {/* searchParams is request data, so it resolves behind a boundary. */}
        <Suspense fallback={<LoginForm next="/dashboard" />}>
          <LoginFormWithRedirect searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
