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
  manual_bypass: "Görevli tarafından giriş yapıldı.",
  consents_required: "Önce yasal onayları tamamlaman gerekiyor.",
};

// Staff-facing wording for the same reasons (admin gate history).
export const ADMIN_ACCESS_REASON_LABELS: Record<string, string> = {
  no_subscription: "Üyelik yok",
  subscription_past_due: "Ödeme gecikmiş",
  subscription_paused: "Üyelik dondurulmuş",
  subscription_canceled: "Üyelik iptal",
  user_not_found: "Üye bulunamadı",
  token_expired: "QR süresi dolmuş",
  token_already_used: "QR tekrar kullanıldı",
  invalid_token: "Geçersiz QR",
  manual_bypass: "Manuel geçiş",
};
