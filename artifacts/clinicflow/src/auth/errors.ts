import { friendlyError } from "@/lib/friendly-error";

/**
 * Auth error presentation. Delegates to the central translator so raw HTTP lines
 * ("HTTP 401 Unauthorized"), stack traces or provider text are never shown (finding 20).
 * Human credential/validation messages from the server are preserved.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  return friendlyError(error, "auth", fallback);
}
