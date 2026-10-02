import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { JWT_AUDIENCE, JWT_ISSUER, SESSION_AGE_SECONDS, jwtSigningKey } from "./auth-config";

const PURPOSE = "app-session";

export async function signSessionJwt(userId: string, issuedAt = Math.floor(Date.now() / 1000)) {
  if (!userId || userId.trim() !== userId) throw new Error("Invalid session subject");
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE)
    .setSubject(userId).setJti(randomUUID()).setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_AGE_SECONDS).sign(jwtSigningKey());
}

/** Invalid credentials are anonymous; configuration failures are never a native fallback. */
export async function verifySessionJwt(token: string): Promise<string | undefined> {
  const key = jwtSigningKey();
  try {
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      algorithms: ["HS256"], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      typ: "JWT", requiredClaims: ["sub", "jti", "iat", "exp", "purpose"],
      maxTokenAge: SESSION_AGE_SECONDS,
    });
    if (protectedHeader.typ !== "JWT" || payload.purpose !== PURPOSE ||
      typeof payload.sub !== "string" || !payload.sub || payload.sub.trim() !== payload.sub ||
      typeof payload.jti !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.jti) ||
      !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) ||
      payload.iat! > Math.floor(Date.now() / 1000) ||
      payload.exp! - payload.iat! !== SESSION_AGE_SECONDS ||
      payload.aud !== JWT_AUDIENCE) return undefined;
    return payload.sub;
  } catch { return undefined; }
}