// Brand copy and the canonical origin, shared by metadata, the OG image,
// robots.txt and the sitemap.
export const SITE = {
  name: "Pulse Fitness",
  title: "Pulse Fitness · QR ile girişli modern spor salonu",
  description:
    "Pulse Fitness'ta sınırsız antrenman: aylık veya yıllık üyeliğini çevrimiçi başlat, telefonundaki QR kodla turnikeden saniyeler içinde geç.",
  tagline: "Telefonunla gir, hemen antrenmana başla.",
  locale: "tr_TR",
  themeColor: "#e8452c",
} as const;

/**
 * Canonical public origin (no trailing slash). APP_URL is read when metadata
 * is generated; set it in production so OG/canonical URLs are absolute and correct.
 */
export function siteUrl(): URL {
  return new URL(process.env.APP_URL || "http://localhost:3000");
}

/**
 * Fields every page's openGraph must repeat: a page-level `openGraph` replaces
 * the layout's object instead of merging with it.
 */
export const BASE_OPEN_GRAPH = {
  type: "website",
  siteName: SITE.name,
  locale: SITE.locale,
  // The app/opengraph-image.tsx route; listed explicitly because an override
  // without `images` drops the file-based image too.
  images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` }],
};
