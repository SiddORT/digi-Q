import { useState } from "react";
import { resolveContactDraft, type ContactDraft } from "./contact-draft";
import { normalizePhone } from "../../lib/validators";
import { bookingValidation } from "./booking-fields";

export function useBookingContact(actor: string, mode: string, patientId: string, saved: string) {
  const [drafts, setDrafts] = useState<Record<string, ContactDraft>>({});
  const key = JSON.stringify([actor, mode, mode === "walkIn" ? "" : patientId]);
  const draft = resolveContactDraft(drafts[key], saved);
  const value = normalizePhone(draft.value);
  const validation = bookingValidation.mobile(draft.value);
  return {
    value,
    error: validation === true ? undefined : validation,
    onChange: (next: string) => setDrafts(previous => ({ ...previous, [key]: { value: next, edited: true } })),
  };
}
