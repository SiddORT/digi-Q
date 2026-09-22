type ClerkLikeError = {
  message?: string;
  longMessage?: string;
  errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
};

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error) {
    const clerk = error as ClerkLikeError;
    const item = clerk.errors?.[0];
    return item?.longMessage || item?.message || clerk.longMessage || clerk.message || fallback;
  }
  return fallback;
}