/** The supplied DigiQ Doctors lockup, including its tagline and trademark. */
export const BRAND_NAME = "DigiQ Doctors";
export const BRAND_LOGO_URL = `${import.meta.env.BASE_URL}digiq-doctors-logo.png`;

/** Clerk requires an absolute URL for its hosted logo. */
export function brandLogoAbsoluteUrl() {
  return new URL(BRAND_LOGO_URL, window.location.origin).href;
}