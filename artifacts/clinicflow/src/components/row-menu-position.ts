export type Box = { top: number; left: number; right: number; bottom: number };
/** Host = dialog (or null for body). clientTop/Left are border widths; scroll offsets apply because a transformed
 *  host is the containing block for position:fixed, which then behaves like absolute inside its padding box. */
export type HostMetrics = { rect: Box; clientTop: number; clientLeft: number; clientWidth: number; clientHeight: number; scrollTop: number; scrollLeft: number };
export type MenuPosition = { top: number; left: number; maxHeight: number; maxWidth: number; placement: "below" | "above" };

export const MENU_GAP = 4, MENU_MARGIN = 8;

/** Visible bounds = viewport, intersected with the host's client (padding) box when hosted in a dialog, inset by margin. */
export function menuBounds(vw: number, vh: number, host: HostMetrics | null, margin = MENU_MARGIN): Box {
  let b: Box = { top: 0, left: 0, right: vw, bottom: vh };
  if (host) {
    const top = host.rect.top + host.clientTop, left = host.rect.left + host.clientLeft;
    b = { top: Math.max(b.top, top), left: Math.max(b.left, left), right: Math.min(b.right, left + host.clientWidth), bottom: Math.min(b.bottom, top + host.clientHeight) };
  }
  return { top: b.top + margin, left: b.left + margin, right: Math.max(b.left + margin, b.right - margin), bottom: Math.max(b.top + margin, b.bottom - margin) };
}

/** Returns coordinates in the host's fixed-position coordinate space (viewport for body). */
export function computeMenuPosition(trigger: Box, menu: { width: number; height: number }, vw: number, vh: number, host: HostMetrics | null, gap = MENU_GAP): MenuPosition | null {
  const b = menuBounds(vw, vh, host);
  if (trigger.bottom < b.top || trigger.top > b.bottom || trigger.right < b.left || trigger.left > b.right) return null;
  const maxWidth = Math.max(0, b.right - b.left);
  const width = Math.min(menu.width, maxWidth);
  const below = Math.max(0, b.bottom - trigger.bottom - gap), above = Math.max(0, trigger.top - gap - b.top);
  const placement: "below" | "above" = menu.height <= below || below >= above ? "below" : "above";
  // Never exceed the actual available space (no fixed floor that could overflow the bounds).
  const maxHeight = Math.max(0, Math.min(placement === "below" ? below : above, b.bottom - b.top));
  const height = Math.min(menu.height, maxHeight);
  let top = placement === "below" ? trigger.bottom + gap : trigger.top - gap - height;
  top = Math.max(b.top, Math.min(top, b.bottom - height));
  const left = Math.max(b.left, Math.min(trigger.right - width, b.right - width));
  const ox = host ? host.rect.left + host.clientLeft - host.scrollLeft : 0, oy = host ? host.rect.top + host.clientTop - host.scrollTop : 0;
  return { top: top - oy, left: left - ox, maxHeight, maxWidth, placement };
}
