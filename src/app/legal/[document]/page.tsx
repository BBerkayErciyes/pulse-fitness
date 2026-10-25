import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL_DOCUMENTS, LEGAL_TEXTS_ARE_DRAFTS, legalDocument } from "@/lib/legal/documents";

// Known documents are prerendered; any other slug renders on request and
// hits notFound() below (dynamicParams is unsupported with cacheComponents).
export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((d) => ({ document: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[document]">): Promise<Metadata> {
  const doc = legalDocument((await params).document);
  return doc ? { title: doc.title, alternates: { canonical: `/legal/${doc.id}` } } : {};
}

const formatVersion = (version: string) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${version}T12:00:00Z`));

export default async function LegalPage({ params }: PageProps<"/legal/[document]">) {
  const doc = legalDocument((await params).document);
  if (!doc) notFound();

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/pricing" aria-label="Pulse Fitness">
            <BrandLogo />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
        <article className="space-y-6 rounded-xl bg-background p-6 text-sm leading-relaxed ring-1 ring-foreground/10 md:p-10">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
            <p className="text-xs text-muted-foreground">Sürüm: {formatVersion(doc.version)}</p>
          </header>
          {LEGAL_TEXTS_ARE_DRAFTS && (
            <p className="flex gap-2 rounded-lg bg-warning/15 p-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              Taslak metin: köşeli parantez içindeki alanlar doldurulup hukuk danışmanı onayı alınana kadar bilgilendirme
              amaçlıdır.
            </p>
          )}
          {LEGAL_CONTENT[doc.id]}
        </article>
        <nav aria-label="Diğer metinler" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {LEGAL_DOCUMENTS.filter((d) => d.id !== doc.id).map((d) => (
            <Link key={d.id} href={`/legal/${d.id}`} className="underline-offset-4 hover:text-foreground hover:underline">
              {d.title}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
