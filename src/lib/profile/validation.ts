export const NAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;

export interface ProfileValues {
  firstName: string;
  lastName: string;
  /** E.164, e.g. "+905551234567"; null when left empty. */
  phone: string | null;
}

export type ProfileField = keyof ProfileValues;

export type ProfileParseResult =
  | { ok: true; values: ProfileValues }
  | { ok: false; errors: Partial<Record<ProfileField, string>> };

// Letters (incl. Turkish and other scripts), with inner spaces, apostrophes,
// hyphens and dots: "Ayşe Nur", "O'Brien", "Jean-Luc".
const NAME_RE = /^\p{L}[\p{L}\p{M}' .-]*$/u;

function parseName(raw: string, label: string): { value: string } | { error: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { error: `${label} boş bırakılamaz.` };
  if (value.length > NAME_MAX_LENGTH) return { error: `${label} en fazla ${NAME_MAX_LENGTH} karakter olabilir.` };
  if (!NAME_RE.test(value)) return { error: `${label} yalnızca harf, boşluk, kesme işareti ve tire içerebilir.` };
  return { value };
}

/**
 * Accepts common Turkish spellings ("0555 123 45 67", "555-123-4567",
 * "+90 (555) 123 45 67") and international numbers with a leading "+",
 * and normalizes them to E.164.
 */
export function normalizePhone(raw: string): { value: string | null } | { error: string } {
  const compact = raw.replace(/[\s().-]/g, "");
  if (!compact) return { value: null };
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return { value: compact };
  if (/^0090[1-9]\d{9}$/.test(compact)) return { value: `+${compact.slice(2)}` };
  if (/^90[1-9]\d{9}$/.test(compact)) return { value: `+${compact}` };
  if (/^0[1-9]\d{9}$/.test(compact)) return { value: `+90${compact.slice(1)}` };
  if (/^[1-9]\d{9}$/.test(compact)) return { value: `+90${compact}` };
  return { error: "Geçerli bir telefon numarası gir (ör. 0555 123 45 67)." };
}

export function parseProfileInput(input: { firstName: unknown; lastName: unknown; phone: unknown }): ProfileParseResult {
  const firstName = parseName(typeof input.firstName === "string" ? input.firstName : "", "Ad");
  const lastName = parseName(typeof input.lastName === "string" ? input.lastName : "", "Soyad");
  const phone = normalizePhone(typeof input.phone === "string" ? input.phone : "");

  const errors: Partial<Record<ProfileField, string>> = {};
  if ("error" in firstName) errors.firstName = firstName.error;
  if ("error" in lastName) errors.lastName = lastName.error;
  if ("error" in phone) errors.phone = phone.error;

  if ("value" in firstName && "value" in lastName && "value" in phone) {
    return { ok: true, values: { firstName: firstName.value, lastName: lastName.value, phone: phone.value } };
  }
  return { ok: false, errors };
}
