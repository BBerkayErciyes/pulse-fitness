import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Şifremi Unuttum" };

async function FormWithLinkError({ searchParams }: Pick<PageProps<"/forgot-password">, "searchParams">) {
  const { error } = await searchParams;
  return <ForgotPasswordForm linkInvalid={error === "link_invalid"} />;
}

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <AuthShell subtitle="Şifreni mi unuttun? Sana bir sıfırlama bağlantısı gönderelim.">
      <Suspense fallback={<ForgotPasswordForm />}>
        <FormWithLinkError searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
