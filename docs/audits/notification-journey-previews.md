# Fictional notification previews

Generated from the workspace's pure template and ticket renderers. These are built-in defaults, not saved effective UAT wording and not sends. Every identity, code, reference and link below is fictional. Disabled recipient templates are deliberately included to expose their wording before any opt-in.

## Actual built-in patient booking delivery

The editor preview is different; this is the special default patient confirmation path.

Subject: **DigiQ Doctors — Appointment confirmation**

```text
Your appointment is confirmed.

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
```

## Booking confirmation — patient

Event: `booking`. Built-in email activation: **on**. **Editor preview only; actual default delivery appears above.**

Subject: **Booking confirmation — Fictional Lotus Clinic**

```text
Hello Example Patient,

Your booking at Fictional Lotus Clinic is confirmed.
Your appointment is confirmed.

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001

reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Booking confirmation — clinicAdmin

Event: `booking`. Built-in email activation: **on**. 

Subject: **Booking confirmation — Fictional Lotus Clinic**

```text
Clinic notification: Booking confirmation
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Booking confirmation — doctor

Event: `booking`. Built-in email activation: **off**. 

Subject: **Booking confirmation — Fictional Lotus Clinic**

```text
Clinic notification: Booking confirmation
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Booking confirmation — receptionist

Event: `booking`. Built-in email activation: **off**. 

Subject: **Booking confirmation — Fictional Lotus Clinic**

```text
Clinic notification: Booking confirmation
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Clinic onboarding — clinicAdmin

Event: `onboarding`. Built-in email activation: **on**. 

Subject: **Clinic onboarding — Fictional Lotus Clinic**

```text
Welcome to Fictional Lotus Clinic.

Complete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.

reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Clinic onboarding — superAdmin

Event: `onboarding`. Built-in email activation: **on**. 

Subject: **Clinic registered — Fictional Lotus Clinic**

```text
Hello Example Recipient,

A clinic has completed registration: Fictional Lotus Clinic.
reception@example.invalid · [fictional clinic phone]
```

## Appointment rescheduled — patient

Event: `rescheduled`. Built-in email activation: **on**. 

Subject: **Appointment rescheduled — Fictional Lotus Clinic**

```text
Hello Example Patient,

Your visit at Fictional Lotus Clinic has been rescheduled.
Previous details: Previous visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 14/01/2030
Session: 14:00–17:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-003
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
New details:
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment rescheduled — clinicAdmin

Event: `rescheduled`. Built-in email activation: **off**. 

Subject: **Appointment rescheduled — Fictional Lotus Clinic**

```text
Clinic notification: Appointment rescheduled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment rescheduled — doctor

Event: `rescheduled`. Built-in email activation: **off**. 

Subject: **Appointment rescheduled — Fictional Lotus Clinic**

```text
Clinic notification: Appointment rescheduled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment rescheduled — receptionist

Event: `rescheduled`. Built-in email activation: **off**. 

Subject: **Appointment rescheduled — Fictional Lotus Clinic**

```text
Clinic notification: Appointment rescheduled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment cancelled — patient

Event: `cancelled`. Built-in email activation: **on**. 

Subject: **Appointment cancelled — Fictional Lotus Clinic**

```text
Hello Example Patient,

Your booking at Fictional Lotus Clinic has been cancelled.
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
Contact the clinic if you need to book another visit.
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment cancelled — clinicAdmin

Event: `cancelled`. Built-in email activation: **off**. 

Subject: **Appointment cancelled — Fictional Lotus Clinic**

```text
Clinic notification: Appointment cancelled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment cancelled — doctor

Event: `cancelled`. Built-in email activation: **off**. 

Subject: **Appointment cancelled — Fictional Lotus Clinic**

```text
Clinic notification: Appointment cancelled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment cancelled — receptionist

Event: `cancelled`. Built-in email activation: **off**. 

Subject: **Appointment cancelled — Fictional Lotus Clinic**

```text
Clinic notification: Appointment cancelled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Thank you after your visit — patient

Event: `completed`. Built-in email activation: **on**. 

Subject: **Thank you after your visit — Fictional Lotus Clinic**

```text
Hello Example Patient,

Thank you for visiting Fictional Lotus Clinic. Your visit is now complete.
For further assistance, contact your clinic.
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Thank you after your visit — clinicAdmin

Event: `completed`. Built-in email activation: **off**. 

Subject: **Thank you after your visit — Fictional Lotus Clinic**

```text
Clinic notification: Thank you after your visit
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Thank you after your visit — doctor

Event: `completed`. Built-in email activation: **off**. 

Subject: **Thank you after your visit — Fictional Lotus Clinic**

```text
Clinic notification: Thank you after your visit
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Thank you after your visit — receptionist

Event: `completed`. Built-in email activation: **off**. 

Subject: **Thank you after your visit — Fictional Lotus Clinic**

```text
Clinic notification: Thank you after your visit
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment reminder — patient

Event: `reminder`. Built-in email activation: **on**. 

Subject: **Appointment reminder — Fictional Lotus Clinic**

```text
Hello Example Patient,

A reminder of your upcoming session at Fictional Lotus Clinic.
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
Queue-based visits do not guarantee an exact consultation time.

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment reminder — clinicAdmin

Event: `reminder`. Built-in email activation: **off**. 

Subject: **Appointment reminder — Fictional Lotus Clinic**

```text
Clinic notification: Appointment reminder
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment reminder — doctor

Event: `reminder`. Built-in email activation: **off**. 

Subject: **Appointment reminder — Fictional Lotus Clinic**

```text
Clinic notification: Appointment reminder
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Appointment reminder — receptionist

Event: `reminder`. Built-in email activation: **off**. 

Subject: **Appointment reminder — Fictional Lotus Clinic**

```text
Clinic notification: Appointment reminder
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]

This is an automated clinic message. Contact your clinic for assistance.
```

## Clinic Admin registration verification — clinicAdmin

Event: `clinic_registration_otp`. Built-in email activation: **on**. 

Subject: **Verify your DigiQ clinic registration**

```text
Your clinic administrator registration code is 123456. It expires in 10 minutes. Verify your email to continue setting up your clinic. This is not a doctor invitation. If you did not start this registration, ignore this email.
```

## Patient email verification — patient

Event: `patient_email_otp`. Built-in email activation: **on**. 

Subject: **Patient email verification**

```text
Your DigiQ email verification code is 123456. It expires in 10 minutes. Do not share this code.
```

## Doctor password setup — doctor

Event: `doctor_setup`. Built-in email activation: **on**. 

Subject: **Doctor password setup**

```text
Hello Example Recipient,

Set up your DigiQ doctor password using this secure, single-use link:
https://example.invalid/set-password?token=fictional-preview-only

This link expires in 10 minutes. We never send passwords. If you did not expect this invitation, contact your administrator.
```

## Staff password setup — clinicAdmin

Event: `staff_setup`. Built-in email activation: **on**. 

Subject: **Staff password setup**

```text
Hello Example Recipient,

Set up your DigiQ Clinic Admin password using this secure, single-use link:
https://example.invalid/set-password?token=fictional-preview-only

This link expires in 10 minutes. We never send passwords. If you did not expect this invitation, contact your administrator.
```

## Staff password setup — receptionist

Event: `staff_setup`. Built-in email activation: **on**. 

Subject: **Staff password setup**

```text
Hello Example Recipient,

Set up your DigiQ staff member password using this secure, single-use link:
https://example.invalid/set-password?token=fictional-preview-only

This link expires in 10 minutes. We never send passwords. If you did not expect this invitation, contact your administrator.
```

## Staff password setup — superAdmin

Event: `staff_setup`. Built-in email activation: **on**. 

Subject: **Staff password setup**

```text
Hello Example Recipient,

Set up your DigiQ staff member password using this secure, single-use link:
https://example.invalid/set-password?token=fictional-preview-only

This link expires in 10 minutes. We never send passwords. If you did not expect this invitation, contact your administrator.
```

## Password setup completed — clinicAdmin

Event: `password_setup_complete`. Built-in email activation: **on**. 

Subject: **Password setup completed**

```text
Hello Example Recipient, your DigiQ staff member password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

## Password setup completed — doctor

Event: `password_setup_complete`. Built-in email activation: **on**. 

Subject: **Password setup completed**

```text
Hello Example Recipient, your DigiQ doctor password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

## Password setup completed — receptionist

Event: `password_setup_complete`. Built-in email activation: **on**. 

Subject: **Password setup completed**

```text
Hello Example Recipient, your DigiQ staff member password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

## Password setup completed — superAdmin

Event: `password_setup_complete`. Built-in email activation: **on**. 

Subject: **Password setup completed**

```text
Hello Example Recipient, your DigiQ staff member password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

# Fictional SMS fallback previews

SMS sends only body text, not an email subject or footer. Operational fallbacks are off. New registration/setup security fallbacks below are blocked until approved content is explicitly published; Required is not approval. Existing patient login SMS separately requires provider/sender/DLT readiness. These are fictional renders only.

## SMS: Booking confirmation — patient

Off by default; optional gates apply

```text
Booking confirmation: Fictional Lotus Clinic
Hello Example Patient,

Your booking at Fictional Lotus Clinic is confirmed.
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001

reception@example.invalid · [fictional clinic phone]
```

## SMS: Booking confirmation — clinicAdmin

Off by default; optional gates apply

```text
Booking confirmation: Fictional Lotus Clinic
Clinic notification: Booking confirmation
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Booking confirmation — doctor

Off by default; optional gates apply

```text
Booking confirmation: Fictional Lotus Clinic
Clinic notification: Booking confirmation
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Booking confirmation — receptionist

Off by default; optional gates apply

```text
Booking confirmation: Fictional Lotus Clinic
Clinic notification: Booking confirmation
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Clinic onboarding — clinicAdmin

Off by default; optional gates apply

```text
Clinic onboarding: Fictional Lotus Clinic
Welcome to Fictional Lotus Clinic.

Complete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.

reception@example.invalid · [fictional clinic phone]
```

## SMS: Clinic onboarding — superAdmin

Off by default; optional gates apply

```text
Clinic onboarding: Fictional Lotus Clinic
Hello Example Recipient,

A clinic has completed registration: Fictional Lotus Clinic.
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment rescheduled — patient

Off by default; optional gates apply

```text
Appointment rescheduled: Fictional Lotus Clinic
Hello Example Patient,

Your visit at Fictional Lotus Clinic has been rescheduled.
Previous details: Previous visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 14/01/2030
Session: 14:00–17:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-003
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
New details:
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
```

## SMS: Appointment rescheduled — clinicAdmin

Off by default; optional gates apply

```text
Appointment rescheduled: Fictional Lotus Clinic
Clinic notification: Appointment rescheduled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment rescheduled — doctor

Off by default; optional gates apply

```text
Appointment rescheduled: Fictional Lotus Clinic
Clinic notification: Appointment rescheduled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment rescheduled — receptionist

Off by default; optional gates apply

```text
Appointment rescheduled: Fictional Lotus Clinic
Clinic notification: Appointment rescheduled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment cancelled — patient

Off by default; optional gates apply

```text
Appointment cancelled: Fictional Lotus Clinic
Hello Example Patient,

Your booking at Fictional Lotus Clinic has been cancelled.
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
Contact the clinic if you need to book another visit.
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment cancelled — clinicAdmin

Off by default; optional gates apply

```text
Appointment cancelled: Fictional Lotus Clinic
Clinic notification: Appointment cancelled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment cancelled — doctor

Off by default; optional gates apply

```text
Appointment cancelled: Fictional Lotus Clinic
Clinic notification: Appointment cancelled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment cancelled — receptionist

Off by default; optional gates apply

```text
Appointment cancelled: Fictional Lotus Clinic
Clinic notification: Appointment cancelled
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Thank you after your visit — patient

Off by default; optional gates apply

```text
Thank you after your visit: Fictional Lotus Clinic
Hello Example Patient,

Thank you for visiting Fictional Lotus Clinic. Your visit is now complete.
For further assistance, contact your clinic.
reception@example.invalid · [fictional clinic phone]
```

## SMS: Thank you after your visit — clinicAdmin

Off by default; optional gates apply

```text
Thank you after your visit: Fictional Lotus Clinic
Clinic notification: Thank you after your visit
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Thank you after your visit — doctor

Off by default; optional gates apply

```text
Thank you after your visit: Fictional Lotus Clinic
Clinic notification: Thank you after your visit
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Thank you after your visit — receptionist

Off by default; optional gates apply

```text
Thank you after your visit: Fictional Lotus Clinic
Clinic notification: Thank you after your visit
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment reminder — patient

Off by default; optional gates apply

```text
Appointment reminder: Fictional Lotus Clinic
Hello Example Patient,

A reminder of your upcoming session at Fictional Lotus Clinic.
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
Queue-based visits do not guarantee an exact consultation time.
```

## SMS: Appointment reminder — clinicAdmin

Off by default; optional gates apply

```text
Appointment reminder: Fictional Lotus Clinic
Clinic notification: Appointment reminder
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment reminder — doctor

Off by default; optional gates apply

```text
Appointment reminder: Fictional Lotus Clinic
Clinic notification: Appointment reminder
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Appointment reminder — receptionist

Off by default; optional gates apply

```text
Appointment reminder: Fictional Lotus Clinic
Clinic notification: Appointment reminder
Patient: Example Patient
Doctor: Dr Example Doctor
Visit details:

Fictional Lotus Clinic · Example East Location
Doctor: Dr Example Doctor
Date: 15/01/2030
Session: 09:00–12:00 (Asia/Kolkata)
Reference: CF-FICTIONAL-001
Token: Q-007
Clinic contact: reception@example.invalid · [fictional clinic phone]

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.
Reference: CF-FICTIONAL-001
reception@example.invalid · [fictional clinic phone]
```

## SMS: Patient login OTP — patient

Required existing login fallback; provider metadata still required

```text
Your DigiQ Doctors login code is 123456. It expires in 10 minutes. Do not share this code.
```

## SMS: Optional registration mobile verification — patient

Required fallback; dispatch blocked without approved publication

```text
Your DigiQ mobile verification code is 123456. It expires in 10 minutes. Do not share this code.
```

## SMS: Optional registration mobile verification — clinicAdmin

Required fallback; dispatch blocked without approved publication

```text
Your DigiQ mobile verification code is 123456. It expires in 10 minutes. Do not share this code.
```

## SMS: Doctor password setup — doctor

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ doctor account is ready for setup. Use the secure link emailed to you. It expires in 10 minutes. No password is sent by SMS.
```

## SMS: Staff password setup — clinicAdmin

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ Clinic Admin account is ready for setup. Use the secure link emailed to you. It expires in 10 minutes. No password is sent by SMS.
```

## SMS: Staff password setup — receptionist

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ staff member account is ready for setup. Use the secure link emailed to you. It expires in 10 minutes. No password is sent by SMS.
```

## SMS: Staff password setup — superAdmin

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ staff member account is ready for setup. Use the secure link emailed to you. It expires in 10 minutes. No password is sent by SMS.
```

## SMS: Password setup completed — clinicAdmin

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ staff member password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

## SMS: Password setup completed — doctor

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ doctor password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

## SMS: Password setup completed — receptionist

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ staff member password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```

## SMS: Password setup completed — superAdmin

Required fallback; dispatch blocked without approved publication

```text
Hello Example Recipient, your DigiQ staff member password setup is complete. No password is included in this message. If you did not do this, contact your administrator.
```
