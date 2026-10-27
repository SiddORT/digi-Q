/** Only a booked branch address may enter an external map URL; never ticket capabilities. */
export function branchDirectionsUrl(address?: string | null): string | null {
  const destination = address?.trim();
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
}
