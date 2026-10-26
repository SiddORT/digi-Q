/** Unsaved Booking Details edits, kept per signed-in actor and appointment so tab and row switches never lose them.
 *  baseRevision is the snapshot taken when editing began; polling never rewrites it. Everything is cleared on save,
 *  discard, authorization loss, or identity change (private data must not outlive access or move between users). */
export type BookingDraft = { mobile: string; notes: string; baseRevision: number; baseBookingRevision: number; baseMobile: string; baseNotes: string; open: boolean };
const drafts = new Map<string, BookingDraft>();
const listeners = new Set<() => void>();
let actor: string | undefined;
let version = 0;
const emit = () => { version++; listeners.forEach(l => l()); };
const key = (id: string) => `${actor ?? ""}:${id}`;
/** Call with the resolved identity ("" when signed out). A change clears every draft. */
export const bindDraftActor = (next: string) => { if (actor !== next) { const had = drafts.size > 0; actor = next; drafts.clear(); if (had) emit(); } };
export const getBookingDraft = (id: string) => actor === undefined ? undefined : drafts.get(key(id));
export const setBookingDraft = (id: string, draft: BookingDraft) => { if (actor === undefined) return; drafts.set(key(id), draft); emit(); };
export const clearBookingDraft = (id: string) => { if (drafts.delete(key(id))) emit(); };
export const clearAllBookingDrafts = () => { if (drafts.size) { drafts.clear(); emit(); } };
export const isBookingDraftDirty = (d?: BookingDraft) => !!d && (d.mobile !== d.baseMobile || d.notes !== d.baseNotes);
export const hasDirtyBookingDrafts = () => [...drafts.values()].some(isBookingDraftDirty);
export const subscribeBookingDrafts = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const bookingDraftVersion = () => version;
