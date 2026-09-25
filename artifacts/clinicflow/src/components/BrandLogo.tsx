import { Link } from "wouter";
import { BRAND_LOGO_URL, BRAND_NAME } from "../branding";

/** Keep the complete supplied lockup visible within the original logo slot. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="brand"
      data-testid="link-home"
      aria-label={`${BRAND_NAME} home`}
      style={{ width: compact ? 160 : 210, height: compact ? 34 : 44, flexShrink: 0 }}
    >
      <img src={BRAND_LOGO_URL} alt={BRAND_NAME} style={{ objectFit: "contain" }} />
    </Link>
  );
}