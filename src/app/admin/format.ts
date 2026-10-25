const TIME_ZONE = "Europe/Istanbul";

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(
    date,
  );

export const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);

export const fullName = (firstName: string | null, lastName: string | null) =>
  `${firstName ?? ""} ${lastName ?? ""}`.trim() || "İsimsiz üye";

/** First value of a search param, trimmed; null when empty. */
export function firstParam(value: string | string[] | undefined): string | null {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  return v ? v : null;
}
