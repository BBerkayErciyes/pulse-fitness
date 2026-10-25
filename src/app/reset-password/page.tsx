import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Yeni Şifre" };

export default function ResetPasswordPage() {
  return (
    <AuthShell subtitle="Hesabın için yeni bir şifre belirle.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
