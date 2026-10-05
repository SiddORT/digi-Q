/** Clinical rule: consultation check-in is explicit and individual. Bulk check-in is forbidden. */
export const BULK_CHECK_IN_ERROR = "Bulk check-in is not permitted. Check in each patient individually from the live queue after confirming identity.";

export function assertIndividualCheckIn(ids: readonly string[]): void {
  if (ids.length !== 1) throw new Error(BULK_CHECK_IN_ERROR);
}
