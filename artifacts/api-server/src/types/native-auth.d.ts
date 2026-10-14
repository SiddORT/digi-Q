import "express";

declare global {
  namespace Express {
    interface Request {
      /** Set only by the native-session middleware, never from request JSON. */
      authUserId?: string;
      /** SHA-256 lookup hash for the currently verified opaque native cookie. */
      authSessionHash?: string;
    }
  }
}
