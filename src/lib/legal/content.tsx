import type { ReactNode } from "react";
import type { LegalDocumentId } from "./documents";

// WORKING DRAFTS. Bracketed placeholders ([ŞİRKET UNVANI] etc.) must be
// filled in and the texts reviewed by a lawyer before relying on them; see
// LEGAL_TEXTS_ARE_DRAFTS in ./documents.ts.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const DISTANCE_SALES = (
  <>
    <Section title="1. Taraflar">
      <p>
        <strong>Satıcı:</strong> [ŞİRKET UNVANI], [ADRES], MERSİS No: [MERSİS NO], Vergi Dairesi/No: [VERGİ DAİRESİ / NO],
        E-posta: [E-POSTA], Telefon: [TELEFON].
      </p>
      <p>
        <strong>Alıcı:</strong> Pulse Fitness üyelik sistemine kayıt olan ve üyelik satın alan kişi (&ldquo;Üye&rdquo;).
        Üyenin kayıt sırasında beyan ettiği ad, soyad ve e-posta bilgileri esas alınır.
      </p>
    </Section>
    <Section title="2. Konu">
      <p>
        Bu sözleşme, Üyenin Satıcıya ait internet sitesi üzerinden elektronik ortamda satın aldığı spor salonu üyelik
        hizmetinin satışı ve ifasına ilişkin olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
        Sözleşmeler Yönetmeliği uyarınca tarafların hak ve yükümlülüklerini düzenler.
      </p>
    </Section>
    <Section title="3. Hizmetin niteliği ve bedeli">
      <p>
        Hizmet, seçilen pakete (aylık veya yıllık) göre salona sınırsız giriş hakkını kapsar. Paket bedeli, vergiler dahil
        olarak ödeme sayfasında gösterilir. Abonelik, Üye iptal edene kadar seçilen dönem sonunda aynı bedelle otomatik
        olarak yenilenir; bedel değişiklikleri yürürlüğe girmeden önce Üyeye bildirilir.
      </p>
    </Section>
    <Section title="4. Ödeme">
      <p>
        Ödemeler, Satıcının anlaşmalı ödeme kuruluşu (Stripe) aracılığıyla kredi/banka kartı ile alınır. Kart bilgileri
        Satıcı tarafından saklanmaz.
      </p>
    </Section>
    <Section title="5. Cayma hakkı">
      <p>
        Üye, sözleşmenin kurulduğu tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin cayma hakkına
        sahiptir. Cayma süresi içinde hizmetten yararlanılmaya başlanmışsa, Mesafeli Sözleşmeler Yönetmeliği uyarınca
        kullanılan süreye karşılık gelen bedel iade tutarından düşülebilir. [CAYMA VE İADE KOŞULLARINI HUKUK
        DANIŞMANINIZLA NETLEŞTİRİN.] Cayma bildirimi [E-POSTA] adresine yapılabilir.
      </p>
    </Section>
    <Section title="6. İptal ve dondurma">
      <p>
        Üye, aboneliğini üye panelinden dilediği zaman iptal edebilir; iptal, ödenmiş dönemin sonunda geçerli olur. Yıllık
        paket sahipleri, panelde belirtilen sürelerle üyeliklerini dondurabilir; dondurma süresince ücret alınmaz ve
        salona giriş yapılamaz.
      </p>
    </Section>
    <Section title="7. Uyuşmazlık">
      <p>
        Uyuşmazlıklarda, Ticaret Bakanlığınca ilan edilen parasal sınırlar dahilinde Üyenin yerleşim yerindeki Tüketici
        Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.
      </p>
    </Section>
    <Section title="8. Yürürlük">
      <p>Üye, bu sözleşmeyi kayıt sırasında elektronik ortamda onaylamakla tüm koşulları kabul etmiş sayılır.</p>
    </Section>
  </>
);

const KVKK = (
  <>
    <Section title="1. Veri sorumlusu">
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca veri sorumlusu [ŞİRKET UNVANI]
        ([ADRES]) olup, kişisel verileriniz aşağıda açıklanan kapsamda işlenmektedir.
      </p>
    </Section>
    <Section title="2. İşlenen kişisel veriler">
      <ul className="list-disc space-y-1 pl-5">
        <li>Kimlik ve iletişim: ad, soyad, e-posta, telefon numarası</li>
        <li>Müşteri işlem: üyelik paketi, abonelik durumu, ödeme kayıtları (kart bilgisi saklanmaz)</li>
        <li>Fiziksel mekan güvenliği: turnike giriş kayıtları (tarih, saat, turnike)</li>
        <li>İşlem güvenliği: IP adresi, tarayıcı bilgisi, onay zaman damgaları</li>
        <li>Sağlık beyanı: yalnızca spora engel bir durumunuz olmadığına dair beyanınızın varlığı (sağlık verisi detayı tutulmaz)</li>
      </ul>
    </Section>
    <Section title="3. İşleme amaçları ve hukuki sebepler">
      <p>
        Verileriniz; üyelik sözleşmesinin kurulması ve ifası (KVKK m.5/2-c), hukuki yükümlülüklerin yerine getirilmesi
        (m.5/2-ç), salon güvenliğinin ve giriş kontrolünün sağlanması ile hizmet kalitesinin artırılması gibi meşru
        menfaatler (m.5/2-f) kapsamında işlenir. Sağlık beyanınıza ilişkin kayıt, açık rızanıza (m.6/2) dayanır.
      </p>
    </Section>
    <Section title="4. Aktarım">
      <p>
        Verileriniz yalnızca hizmetin sunulması için gerekli olduğu ölçüde; ödeme hizmet sağlayıcısı (Stripe), barındırma
        ve veritabanı hizmet sağlayıcıları (Vercel, Supabase) ve e-posta gönderim hizmeti (Resend) ile paylaşılır. Bu
        sağlayıcıların bir kısmı yurt dışında bulunduğundan aktarım KVKK m.9 kapsamında yapılır. [YURT DIŞI AKTARIM
        DAYANAĞINI HUKUK DANIŞMANINIZLA NETLEŞTİRİN.]
      </p>
    </Section>
    <Section title="5. Saklama süresi">
      <p>
        Veriler, üyelik süresince ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır; süre sonunda silinir,
        yok edilir veya anonim hale getirilir.
      </p>
    </Section>
    <Section title="6. Haklarınız">
      <p>
        KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, itiraz etme
        ve zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı [E-POSTA / KEP ADRESİ] üzerinden
        iletebilirsiniz.
      </p>
    </Section>
    <Section title="7. Açık rıza">
      <p>
        Onay kutusunu işaretleyerek bu aydınlatma metnini okuduğunuzu ve sağlık beyanınıza ilişkin kaydın işlenmesine
        açık rıza verdiğinizi beyan edersiniz. Rızanızı dilediğiniz zaman geri alabilirsiniz.
      </p>
    </Section>
  </>
);

const HEALTH = (
  <>
    <Section title="Beyan">
      <p>
        Pulse Fitness salonlarında spor yapmama engel olabilecek bir sağlık sorunum (kalp-damar hastalığı, yüksek tansiyon,
        astım, epilepsi, hamilelik, yakın zamanda geçirilmiş ameliyat vb.) bulunmadığını; böyle bir durum varsa doktorumdan
        spor yapabileceğime dair onay aldığımı beyan ederim.
      </p>
    </Section>
    <Section title="Sorumluluk">
      <p>
        Sağlık durumumda değişiklik olması halinde salon yönetimini bilgilendireceğimi, antrenmanlarımı kendi
        sorumluluğumda ve ekipmanları kullanım talimatlarına uygun şekilde yapacağımı kabul ederim. Beyanımın gerçeğe
        aykırı olmasından doğacak sonuçlardan [ŞİRKET UNVANI] sorumlu tutulamaz. [SORUMLULUK KAPSAMINI HUKUK
        DANIŞMANINIZLA NETLEŞTİRİN.]
      </p>
    </Section>
    <Section title="Kayıt">
      <p>
        Bu beyan yalnızca onayladığım tarih ve saatle birlikte kaydedilir; herhangi bir sağlık bilgisi veya rapor
        istenmez ve saklanmaz.
      </p>
    </Section>
  </>
);

export const LEGAL_CONTENT: Record<LegalDocumentId, ReactNode> = {
  "mesafeli-satis": DISTANCE_SALES,
  kvkk: KVKK,
  "saglik-beyani": HEALTH,
};
