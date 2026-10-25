import type { MetadataRoute } from "next";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { siteUrl } from "@/lib/site";

// Only public pages; "/" just redirects into the app.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: new URL("/pricing", base).toString(), changeFrequency: "monthly", priority: 1 },
    { url: new URL("/signup", base).toString(), changeFrequency: "yearly", priority: 0.8 },
    { url: new URL("/login", base).toString(), changeFrequency: "yearly", priority: 0.5 },
    ...LEGAL_DOCUMENTS.map((d) => ({
      url: new URL(`/legal/${d.id}`, base).toString(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
