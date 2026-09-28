type AuthServiceError = {
  message?: string;
  longMessage?: string;
  errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
};

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error) {
    const serviceError = error as AuthServiceError;
    const item = serviceError.errors?.[0];
    return item?.longMessage || item?.message || serviceError.longMessage || serviceError.message || fallback;
  }
  return fallback;
}