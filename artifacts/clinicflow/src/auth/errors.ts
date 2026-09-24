type AuthServiceError = {
  message?: string;
  longMessage?: string;
  errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
};

function sanitizeAuthMessage(message: string): string {
  return message
    .replace(/\bClerk(?:'s)?\b/gi, "the authentication service")
    .replace(/https?:\/\/(?:www\.)?clerk\.[^\s)]+/gi, "the authentication service");
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return sanitizeAuthMessage(error.message);
  if (typeof error === "object" && error) {
    const serviceError = error as AuthServiceError;
    const item = serviceError.errors?.[0];
    return sanitizeAuthMessage(item?.longMessage || item?.message || serviceError.longMessage || serviceError.message || fallback);
  }
  return fallback;
}