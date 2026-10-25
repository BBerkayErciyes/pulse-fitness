export type ReminderKind = "renewal" | "ending" | "past_due";

export interface ReminderContext {
  firstName: string;
  planName: string;
  /** Formatted price, e.g. "₺499,00 / ay"; null if Stripe could not be reached. */
  price: string | null;
  periodEnd: Date;
  dashboardUrl: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(date);

interface Copy {
  subject: string;
  heading: string;
  body: string[];
  cta: string;
}

function copyFor(kind: ReminderKind, ctx: ReminderContext): Copy {
  const date = formatDate(ctx.periodEnd);
  switch (kind) {
    case "renewal":
      return {
        subject: `Üyeliğin ${date} tarihinde yenilenecek`,
        heading: "Üyeliğin yenilenmek üzere",
        body: [
          `${ctx.planName} üyeliğin ${date} tarihinde otomatik olarak yenilenecek${ctx.price ? ` (${ctx.price})` : ""}.`,
          "Kartının güncel olduğundan emin olmak ya da paketini değiştirmek için üye paneline göz atabilirsin.",
        ],
        cta: "Üyeliğimi yönet",
      };
    case "ending":
      return {
        subject: `Üyeliğin ${date} tarihinde sona eriyor`,
        heading: "Üyeliğin sona ermek üzere",
        body: [
          `${ctx.planName} üyeliğin ${date} tarihinde sona erecek ve yenilenmeyecek.`,
          "Antrenmanlarına ara vermek istemezsen üye panelinden iptali geri alabilirsin.",
        ],
        cta: "Üyeliğimi devam ettir",
      };
    case "past_due":
      return {
        subject: "Üyelik ödemen alınamadı",
        heading: "Ödemen alınamadı",
        body: [
          `${ctx.planName} üyeliğinin son ödemesini kartından tahsil edemedik.`,
          "Salona girişin şimdilik açık; kesinti yaşamamak için birkaç gün içinde üye panelinden ödeme yöntemini güncelle.",
        ],
        cta: "Ödeme yöntemini güncelle",
      };
  }
}

export function renderReminder(kind: ReminderKind, ctx: ReminderContext) {
  const copy = copyFor(kind, ctx);
  const greeting = `Merhaba ${ctx.firstName || "üyemiz"},`;

  const text = [greeting, "", ...copy.body, "", `${copy.cta}: ${ctx.dashboardUrl}`, "", "Pulse Fitness"].join("\n");
  const html = `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="font-size:18px;font-weight:600;padding-bottom:24px">Pulse<span style="color:#e8452c">Fitness</span></td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${escapeHtml(copy.heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-bottom:8px">${escapeHtml(greeting)}</td></tr>
${copy.body.map((p) => `<tr><td style="font-size:15px;line-height:1.6;padding-bottom:8px">${escapeHtml(p)}</td></tr>`).join("\n")}
<tr><td style="padding-top:16px"><a href="${escapeHtml(ctx.dashboardUrl)}" style="display:inline-block;background:#e8452c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">${escapeHtml(copy.cta)}</a></td></tr>
<tr><td style="font-size:12px;color:#78716c;padding-top:32px">Bu e-postayı Pulse Fitness üyeliğin olduğu için alıyorsun.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: copy.subject, html, text };
}
