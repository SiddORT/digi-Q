import { useSyncExternalStore } from "react";
/** Shared workspace dialog, without navigation. /check-in remains the printed-link entry. */
let open = false;
let returnFocus: HTMLElement | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const openQrInline = () => {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Quick-action buttons unmount with their menu/search; restore the stable launcher instead.
  returnFocus = active?.closest(".profile-menu")?.querySelector<HTMLElement>(".profile-menu-trigger")
    ?? (active?.closest('[role="dialog"]') ? document.querySelector<HTMLElement>(".workspace-search-trigger") : active);
  open = true; emit();
};
export const qrReturnFocus = () => returnFocus;
export const closeQrInline = () => { open = false; emit(); };
export const isQrInlineOpen = () => open;
export function useQrInline() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, isQrInlineOpen, isQrInlineOpen);
}
