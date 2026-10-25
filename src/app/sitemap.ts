import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only public pages; "/" just redirects into the app.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: new URL("/pricing", base).toString(), changeFrequency: "monthly", priority: 1 },
    { url: new URL("/login", base).toString(), changeFrequency: "yearly", priority: 0.5 },
  ];
}
