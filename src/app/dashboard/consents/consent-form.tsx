"use client";

import { useActionState } from "react";
import { ConsentCheckboxes } from "@/components/consent-checkboxes";
import { Button } from "@/components/ui/button";
import { legalDocument, type LegalDocument } from "@/lib/legal/documents";
import { acceptConsents, type ConsentFormState } from "./actions";

export function ConsentForm({ documentIds }: { documentIds: string[] }) {
  const [state, action, pending] = useActionState<ConsentFormState, FormData>(acceptConsents, {});
  const documents = documentIds.map(legalDocument).filter((d): d is LegalDocument => d !== null);

  return (
    <form action={action} className="space-y-5">
      <ConsentCheckboxes documents={documents} error={state.error} disabled={pending} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Onayla ve devam et"}
      </Button>
    </form>
  );
}
