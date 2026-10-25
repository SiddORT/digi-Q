export type ContactDraft = { value: string; edited: boolean };

/** Only untouched drafts hydrate. Empty edited values deliberately stay empty. */
export function resolveContactDraft(draft: ContactDraft | undefined, saved: string): ContactDraft {
  return draft?.edited ? draft : { value: saved, edited: false };
}
