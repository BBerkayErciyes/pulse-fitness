import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static, prerendered at build time; used by every route that does not
// define its own opengraph-image (Twitter falls back to og:image).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #1a0d0b 0%, #2b120e 55%, #e8452c 160%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: SITE.themeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* lucide "activity" glyph, same as the in-app logo */}
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 44, letterSpacing: -1 }}>
            Pulse<span style={{ color: SITE.themeColor }}>Fitness</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 900 }}>{SITE.tagline}</div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.72)", maxWidth: 900 }}>
            Sınırsız giriş · Aylık ve yıllık paketler · QR ile temassız turnike
          </div>
        </div>
      </div>
    ),
    size,
  );
}
