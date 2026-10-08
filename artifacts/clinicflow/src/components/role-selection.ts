/** Namespaces prevent a custom ID from being mistaken for a built-in role. */
export const systemSelection = (key: string) => `system:${key}`;
export const customSelection = (id: string) => `custom:${id}`;
export function roleDestination(search: string, area: string, role?: string) {
  const query = new URLSearchParams(search);
  query.set("area", area);
  if (role !== undefined) query.set("role", role);
  return `/admin/users?${query}`;
}
