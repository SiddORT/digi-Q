/** The only scope authorized for default/existing-clinic activation. */
export const appointmentNotificationEvents = ["booking", "rescheduled", "cancelled", "completed", "reminder"] as const;
export const appointmentNotificationRecipients = ["patient", "clinicAdmin", "doctor"] as const;
export function appointmentNotificationTarget(event: string, recipient: string) {
  return (appointmentNotificationEvents as readonly string[]).includes(event) &&
    (appointmentNotificationRecipients as readonly string[]).includes(recipient);
}
export const appointmentActivationId = "appointment-notification-activation";
