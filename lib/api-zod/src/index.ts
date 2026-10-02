export * from "./generated/api";
export * from "./generated/types";
// Prefer the runtime path validator over Orval's same-named query-only TS alias.
export { GetDoctorPresenceParams } from "./generated/api";
export { ResolveClinicSlugParams, ResolveBranchSlugParams } from "./generated/api";
