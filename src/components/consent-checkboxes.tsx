import Link from "next/link";
import { consentFieldName, type LegalDocument } from "@/lib/legal/documents";
import { cn } from "@/lib/utils";

/**
 * One required checkbox per legal document, each linking to its full text.
 * Native `required` blocks submission in the browser; the server action
 * re-checks every box, since the browser check is trivially bypassed.
 */
export function ConsentCheckboxes({
  documents,
  error,
  disabled = false,
}: {
  documents: readonly LegalDocument[];
  error?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2.5" disabled={disabled} aria-describedby={error ? "consent-error" : undefined}>
      <legend className="sr-only">Yasal onaylar</legend>
      {documents.map((doc) => (
        <label key={doc.id} className="flex items-start gap-2.5 text-sm leading-snug">
          <input
            type="checkbox"
            name={consentFieldName(doc.id)}
            required
            className={cn("mt-0.5 size-4 shrink-0 accent-primary", error && "outline outline-destructive")}
          />
          <span>
            <Link
              href={`/legal/${doc.id}`}
              target="_blank"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {doc.title}
            </Link>{" "}
            metnini okudum, onaylıyorum.
          </span>
        </label>
      ))}
      {error && (
        <p id="consent-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
