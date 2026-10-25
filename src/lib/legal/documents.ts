// Legal texts members must accept. Bump a document's `version` whenever its
// text changes materially: everyone is then asked to accept the new version
// (old acceptances stay in user_consents as evidence).
export const LEGAL_DOCUMENTS = [
  {
    id: "mesafeli-satis",
    title: "Mesafeli Satış Sözleşmesi",
    short: "Mesafeli Satış Sözleşmesi'ni",
    version: "2026-10-26",
  },
  {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni ve Açık Rıza Beyanı",
    short: "KVKK Aydınlatma Metni'ni ve Açık Rıza Beyanı'nı",
    version: "2026-10-26",
  },
  {
    id: "saglik-beyani",
    title: "Sağlık Beyanı",
    short: "Sağlık Beyanı'nı",
    version: "2026-10-26",
  },
] as const;

export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];
export type LegalDocumentId = LegalDocument["id"];

/**
 * The texts in ./content.tsx are working drafts with placeholders. Keep this
 * true (it shows a notice on the pages) until a lawyer has reviewed them and
 * the placeholders are filled in.
 */
export const LEGAL_TEXTS_ARE_DRAFTS = true;

export const legalDocument = (id: string) => LEGAL_DOCUMENTS.find((d) => d.id === id) ?? null;
export const consentFieldName = (id: LegalDocumentId) => `consent_${id}`;
