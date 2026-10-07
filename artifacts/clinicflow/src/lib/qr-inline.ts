import { useSyncExternalStore } from "react";
/** In-app QR validation opens inline on the current page (no navigation). The public /check-in route stays a direct entry. */
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const openQrInline = () => { open = true; emit(); };
export const closeQrInline = () => { open = false; emit(); };
export const isQrInlineOpen = () => open;
export function useQrInline() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, isQrInlineOpen, isQrInlineOpen);
}
