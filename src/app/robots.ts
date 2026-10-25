import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Member/staff areas and machine endpoints have nothing to index.
      disallow: ["/admin", "/dashboard", "/api/", "/auth/", "/reset-password"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
