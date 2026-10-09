import { z } from "zod";

const text = z.string().max(2000);
const interval = z.object({ startTime: text, endTime: text });
const day = z.object({ dayOfWeek: z.number().int().min(0).max(6), isOpen: z.boolean(), sessions: z.array(interval).max(28) });
const locality = z.object({ key: text, segment: text, offset: z.number().int().min(0) });
const branch = z.object({
  name: text, slug: text, address: text, city: text, state: text.optional(), pincode: text.optional(), country: text.optional(),
  timezone: text, email: text, phone: text, inheritEmail: z.boolean(), inheritPhone: z.boolean(), hours: z.array(day).length(7),
  localities: z.array(locality).max(12).optional(),
});
// Explicit allowlists: never persist credentials, passwords, OTPs or server record IDs.
export const setupDraftSchema = z.object({
  step: z.number().int().min(0).max(5), requestId: z.string().uuid(),
  values: z.object({
    dateFormat: z.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]), timeFormat: z.enum(["12h", "24h"]),
    fullName: text, email: text, mobile: text, name: text, slug: text, categoryId: text, specialityIds: z.array(text),
    referralCode: text, clinicEmail: text, phone: text, branches: z.array(branch).min(1).max(30),
    alsoConsult: z.boolean(), specializationId: text, qualificationIds: z.array(text), linkConsultationHours: z.boolean(),
    sessionCapacity: text, consultationMinutes: text,
    ownerWeeks: z.array(z.array(day.extend({ sessions: z.array(interval.extend({ key: text })) })).length(7)).max(30).optional(),
  }),
});
export const accountDraftSchema = z.object({ fullName: text, email: text, step: z.enum(["details", "review", "verify"]) });
const AGE = 24 * 60 * 60 * 1000;
export const registrationDraftKey = (mode: string, actor: string) => `digiq:registration:v1:${mode}:${actor}`;
export function readRegistrationDraft<T>(key: string, schema: z.ZodType<T>): { data?: T; stored: boolean } {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { stored: true };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Number.isFinite(parsed.expires) || parsed.expires <= Date.now() || parsed.expires > Date.now() + AGE) {
      sessionStorage.removeItem(key); return { stored: true };
    }
    const result = schema.safeParse(parsed.data);
    if (!result.success) { sessionStorage.removeItem(key); return { stored: true }; }
    return { data: result.data, stored: true };
  } catch { return { stored: false }; }
}
export function writeRegistrationDraft<T>(key: string, schema: z.ZodType<T>, data: T): boolean {
  try { sessionStorage.setItem(key, JSON.stringify({ version: 1, expires: Date.now() + AGE, data: schema.parse(data) })); return true; }
  catch { return false; }
}
export function clearRegistrationDraft(key: string): boolean {
  try { sessionStorage.removeItem(key); return true; } catch { return false; }
}
