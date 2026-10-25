import type { SubscriptionStatus } from "@/db/schema";

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Aktif",
  past_due: "Ödeme Gecikti",
  paused: "Donduruldu",
  canceled: "İptal Edildi",
};

// Reasons returned by /api/access/generate and /api/access/validate.
export const ACCESS_REASON_LABELS: Record<string, string> = {
  no_subscription: "Aktif bir üyeliğin bulunmuyor.",
  subscription_paused: "Üyeliğin dondurulmuş durumda.",
  subscription_canceled: "Üyeliğin iptal edilmiş.",
  user_not_found: "Üye kaydın bulunamadı.",
  token_expired: "QR kodun süresi dolmuştu.",
  token_already_used: "Bu QR kod daha önce kullanıldı.",
  invalid_token: "Geçersiz QR kod.",
};
