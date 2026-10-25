/**
 * Public base URL for links sent to third parties (Stripe redirects).
 * Prefers APP_URL: behind a proxy the request origin can be an internal host
 * and Stripe would send members there.
 */
export function appUrl(request: Request): string {
  return (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}
