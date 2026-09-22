import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") { super(message); }
}
export function assert(value: unknown, status: number, message: string): asserts value {
  if (!value) throw new HttpError(status, message);
}
export function parse(schema: any, value: any) {
  validateDates(value);
  if (value?.mobile) assert(/^\+[1-9][0-9]{7,14}$/.test(value.mobile), 400, "Mobile must use international format, for example +919876543210");
  return normalizeDates(schema.parse(value));
}
function validateDates(value: any) {
  for (const key of ["date", "from", "to", "dateOfBirth"]) {
    if (value?.[key] !== undefined) {
      const v = value[key];
      assert(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 400, `Invalid ${key}; expected YYYY-MM-DD`);
    }
  }
}
function normalizeDates(value: any): any {
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, normalizeDates(v)]));
  return value;
}
export function query(schema: any, req: Request) {
  const q: Record<string, any> = { ...req.query };
  validateDates(q);
  for (const k of ["date", "from", "to"]) if (q[k] !== undefined) q[k] = new Date(q[k]);
  for (const k of ["page", "pageSize"]) if (q[k] !== undefined) q[k] = Number(q[k]);
  const result = normalizeDates(schema.parse(q));
  for (const [key, value] of Object.entries(result)) assert(value !== "undefined", 400, `${key} is required`);
  return result;
}
const integrityCodes = new Set(["23505", "23503", "23514", "23P01"]);
export function databaseIntegrityCode(error: unknown): string | null {
  const seen = new Set<unknown>();
  let current: any = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8 && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current.code === "string" && integrityCodes.has(current.code)) return current.code;
    current = current.cause;
  }
  return null;
}
export function errors(err: any, req: Request, res: Response, _next: NextFunction) {
  const validation = err instanceof ZodError || err.name === "ZodError";
  const conflictCode = databaseIntegrityCode(err);
  const conflict = Boolean(conflictCode);
  const status = err.status || (validation ? 400 : conflict ? 409 : 500);
  if (status >= 500) req.log.error({ err }, "Request failed");
  res.status(status).json({ error: validation ? "Invalid input: " + err.issues.map((i: any) => `${i.path.join(".")} ${i.message}`).join("; ") : conflict ? "Record conflicts with existing data or references" : status >= 500 ? "Service unavailable. Please retry." : err.message, code: validation ? "VALIDATION_ERROR" : conflict ? "CONFLICT" : err.code || "REQUEST_FAILED" });
}