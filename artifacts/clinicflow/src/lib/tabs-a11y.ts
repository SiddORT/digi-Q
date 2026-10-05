import { useId, type KeyboardEvent } from "react";

/** WAI-ARIA tabs keyboard model: ArrowLeft/Right (and Up/Down), Home, End move and activate. */
export function tabListKeyDown<T extends string>(e: KeyboardEvent<HTMLElement>, ids: readonly T[], current: T, select: (id: T) => void) {
  const i = Math.max(0, ids.indexOf(current));
  const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % ids.length
    : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + ids.length) % ids.length
    : e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : -1;
  if (next < 0) return;
  e.preventDefault();
  select(ids[next]);
  const tabs = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs[next]?.focus();
}

/** Stable tab/panel ID pairs plus roving tabindex props for a tab set. */
export function useTabIds<T extends string>(ids: readonly T[], current: T, select: (id: T) => void) {
  const base = useId().replace(/:/g, "");
  return {
    list: { role: "tablist" as const, onKeyDown: (e: KeyboardEvent<HTMLElement>) => tabListKeyDown(e, ids, current, select) },
    tab: (id: T) => ({ role: "tab" as const, id: `${base}-tab-${id}`, "aria-selected": current === id, "aria-controls": `${base}-panel-${id}`, tabIndex: current === id ? 0 : -1, onClick: () => select(id) }),
    panel: (id: T) => ({ role: "tabpanel" as const, id: `${base}-panel-${id}`, "aria-labelledby": `${base}-tab-${id}`, tabIndex: 0 }),
  };
}

/** Menu keyboard model: Arrow keys/Home/End move focus between enabled menu items. */
export function menuKeyDown(e: KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]')].filter(el => !(el as HTMLButtonElement).disabled);
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === "ArrowDown" ? (i + 1) % items.length : e.key === "ArrowUp" ? (i <= 0 ? items.length - 1 : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
  if (next < 0) return;
  e.preventDefault();
  items[next].focus();
}
