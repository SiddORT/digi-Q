import { HttpError } from "./http";

export const SESSION_AGE_SECONDS = 12 * 60 * 60;
export const SESSION_AGE = SESSION_AGE_SECONDS * 1000;
export const JWT_ISSUER = "digiq-doctors";
export const JWT_AUDIENCE = "digiq-doctors-session";

// Lazy configuration: an unavailable signing key must not take guest booking offline.
export function sessionMode(env: NodeJS.ProcessEnv = process.env): "native" | "jwt" {
  const mode = env.AUTH_SESSION_MODE ?? "native";
  if (mode !== "native" && mode !== "jwt")
    throw new HttpError(503, "Authentication session mode is invalid", "AUTH_SESSION_UNCONFIGURED");
  return mode;
}

export function jwtSigningKey(env: NodeJS.ProcessEnv = process.env): Uint8Array {
  const key = env.JWT_SIGNING_KEY;
  if (!key || key.trim() !== key || Buffer.byteLength(key, "utf8") < 32)
    throw new HttpError(503, "JWT signing key is not configured correctly", "AUTH_SESSION_UNCONFIGURED");
  return new TextEncoder().encode(key);
}