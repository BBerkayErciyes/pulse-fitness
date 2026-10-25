import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

// Only same-origin paths, never "//evil.com" style protocol-relative URLs.
function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

async function LoginFormWithRedirect({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return <LoginForm next={safeNext(next)} linkInvalid={error === "link_invalid"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell subtitle="Üye paneline giriş yap, QR kodunla salona gir.">
      {/* searchParams is request data, so it resolves behind a boundary. */}
      <Suspense fallback={<LoginForm next="/dashboard" />}>
        <LoginFormWithRedirect searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
