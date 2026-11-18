/** Presentation grouping only: event identities, activation and challenge purposes remain independent. */
export const mobileVerificationEvents = ["registration_mobile_otp", "staff_mobile_otp"];
export const isMobileVerification = (event: string) => mobileVerificationEvents.includes(event);
export const administrationEvent = (event: string) => isMobileVerification(event) ? "mobile_verification" : event;
export const mobileVerificationContext = (event: string) =>
  event === "registration_mobile_otp" ? "Registration phone proof" : "Existing-account contact proof";
