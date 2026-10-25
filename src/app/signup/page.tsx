import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Üye Ol",
  description: "Pulse Fitness'a üye ol: hesabını oluştur, paketini seç, QR kodunla salona gir.",
  alternates: { canonical: "/signup" },
};

export default function SignUpPage() {
  return (
    <AuthShell subtitle="Hesabını oluştur, paketini seç, QR kodunla salona gir.">
      <SignUpForm />
    </AuthShell>
  );
}
