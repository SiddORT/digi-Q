export const SUPER_ADMIN = "superAdmin";
export const permKey = (role: string, module: string, action: string) => `${role}:${module}:${action}`;

/** Checked = baseline allowed (not denied). Super Admin is never restrictable. */
export function isAllowed(denied: Set<string>, role: string, module: string, action: string) {
  return role === SUPER_ADMIN || !denied.has(permKey(role, module, action));
}
export function toggle(denied: Set<string>, key: string, allow: boolean) {
  const next = new Set(denied);
  if (key.startsWith(`${SUPER_ADMIN}:`)) return next;
  if (allow) next.delete(key); else next.add(key);
  return next;
}
export function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}
export const serialize = (s: Set<string>) => [...s].filter(k => !k.startsWith(`${SUPER_ADMIN}:`)).sort();
export const label = (v: string) => v.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());
