import { accountMobileProblem } from "@workspace/api-zod/account-mobile";

/** Safe, fixed explanations only: never interpolate a contact or provider response. */
export function onboardingMobileReason(account: any): string | undefined {
  if (!account) return "Account is missing; select the owning account, not a clinic contact.";
  if (account.status !== "active") return "Account is inactive; restore authorized account access first.";
  if (!account.mobile) return "Account mobile is missing; save and verify it in My Profile.";
  if (accountMobileProblem(account.mobile)) return "Account mobile is invalid; correct and verify it in My Profile.";
  const proof = account.data?.staffMobileProof || account.staffMobileProof;
  if (proof?.contact !== account.mobile || typeof proof.verifiedAt !== "string")
    return "Account mobile is unverified; its owner must confirm the SMS code in Contact verification.";
  return undefined;
}
