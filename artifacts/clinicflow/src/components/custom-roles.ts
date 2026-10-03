/** Pure helpers for the Super Admin custom-role editor. Custom roles only ever narrow a base role. */
export const BASE_ROLES = ["clinicAdmin", "doctor", "receptionist"] as const;
export type BaseRole = (typeof BASE_ROLES)[number];
export interface CustomRole { id: string; name: string; baseRole: BaseRole; denied: string[] }
export interface RoleBinding { userId: string; roleId: string; clinicId?: string | null }
export interface CustomRoleConfig { revision: number; roles: CustomRole[]; bindings: RoleBinding[] }
export interface SystemUserClinic { id: string; name: string }
export interface SystemUser { id: string; fullName: string; email: string; role: string; status: string; clinics: SystemUserClinic[] }

export const capKey = (module: string, action: string) => `${module}:${action}`;

export function newRoleId(existing: CustomRole[]) {
  let id = "";
  do id = `role_${Math.random().toString(36).slice(2, 10)}`; while (existing.some(r => r.id === id));
  return id;
}

export function validateRole(role: CustomRole, all: CustomRole[]): string | null {
  const name = role.name.trim();
  if (!name) return "Enter a role name.";
  if (name.length > 80) return "Role name must be 80 characters or fewer.";
  if (!BASE_ROLES.includes(role.baseRole)) return "Choose a base role.";
  if (all.some(r => r.id !== role.id && r.name.trim().toLowerCase() === name.toLowerCase())) return "Another custom role already uses this name.";
  return null;
}

export function upsertRole(config: CustomRoleConfig, role: CustomRole): CustomRoleConfig {
  const exists = config.roles.some(r => r.id === role.id);
  const previous = config.roles.find(r => r.id === role.id);
  const roles = exists ? config.roles.map(r => (r.id === role.id ? { ...role, name: role.name.trim(), denied: [...new Set(role.denied)].sort() } : r)) : [...config.roles, { ...role, name: role.name.trim(), denied: [...new Set(role.denied)].sort() }];
  // Changing the base role invalidates assignments: staff must match the base role.
  const bindings = previous && previous.baseRole !== role.baseRole ? config.bindings.filter(b => b.roleId !== role.id) : config.bindings;
  return { ...config, roles, bindings };
}

export const bindingsFor = (config: CustomRoleConfig, roleId: string) => config.bindings.filter(b => b.roleId === roleId);

/** Deletion is blocked while bindings exist unless the caller explicitly removes them too. */
export function deleteRole(config: CustomRoleConfig, roleId: string, removeBindings: boolean): CustomRoleConfig | { blocked: number } {
  const count = bindingsFor(config, roleId).length;
  if (count && !removeBindings) return { blocked: count };
  return { ...config, roles: config.roles.filter(r => r.id !== roleId), bindings: config.bindings.filter(b => b.roleId !== roleId) };
}

export const sameBinding = (a: RoleBinding, b: RoleBinding) => a.userId === b.userId && a.roleId === b.roleId && (a.clinicId || "") === (b.clinicId || "");

export function bindingError(role: CustomRole, user: SystemUser | null | undefined, clinicId: string, config: CustomRoleConfig): string | null {
  if (!user) return "Choose a staff member.";
  if (user.role !== role.baseRole) return "Only staff whose role matches the base role can be assigned.";
  if (user.status !== "active") return "Only active staff can be assigned.";
  if (clinicId && !user.clinics.some(c => c.id === clinicId)) return "Choose one of this staff member's assigned clinics.";
  if (config.bindings.some(b => sameBinding(b, { userId: user.id, roleId: role.id, clinicId }))) return "This assignment already exists.";
  return null;
}

export function addBinding(config: CustomRoleConfig, binding: RoleBinding): CustomRoleConfig {
  const clean = { userId: binding.userId, roleId: binding.roleId, ...(binding.clinicId ? { clinicId: binding.clinicId } : {}) };
  return config.bindings.some(b => sameBinding(b, clean)) ? config : { ...config, bindings: [...config.bindings, clean] };
}
export const removeBinding = (config: CustomRoleConfig, binding: RoleBinding): CustomRoleConfig => ({ ...config, bindings: config.bindings.filter(b => !sameBinding(b, binding)) });

export const serializeConfig = (c: Pick<CustomRoleConfig, "roles" | "bindings">) => JSON.stringify({
  roles: [...c.roles].map(r => ({ id: r.id, name: r.name, baseRole: r.baseRole, denied: [...r.denied].sort() })).sort((a, b) => a.id.localeCompare(b.id)),
  bindings: [...c.bindings].map(b => ({ userId: b.userId, roleId: b.roleId, clinicId: b.clinicId || "" })).sort((a, b) => `${a.roleId}${a.userId}${a.clinicId}`.localeCompare(`${b.roleId}${b.userId}${b.clinicId}`)),
});
export const configsEqual = (a: Pick<CustomRoleConfig, "roles" | "bindings">, b: Pick<CustomRoleConfig, "roles" | "bindings">) => serializeConfig(a) === serializeConfig(b);
