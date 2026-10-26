# Patient access and verification

## Automated checks (simulated delivery only)

Run:

```sh
node --test --test-concurrency=1 artifacts/api-server/src/native-auth.integration.test.mjs artifacts/api-server/src/auth-http.integration.test.mjs artifacts/clinicflow/src/auth/patient-access.render.test.mjs artifacts/clinicflow/src/auth/security-notifications.render.test.mjs
```

The backend tests use a disposable local PostgreSQL database and fake email/SMS
transports. They do not use real recipients, external providers or production data.
Frontend render tests cover entry choices, optional proof, initial outcomes and
legacy/booking links. Browser checks should intercept all authentication requests
before submitting any forms. A passing simulation does not establish provider
readiness, inbox arrival or handset receipt.

## User-operated check with your own email and phone

Only perform these steps when you intend to request real verification messages.
Do not use anyone else's contact details. Do not enable or change administrator
delivery settings just to run this check.

1. Signed out, open the homepage. Check Patient Access / Sign Up in navigation
   (also in the narrow-screen menu), Patient Sign Up and Patient Login on the
   homepage, and Guest Booking. Guest Booking must not ask for an account.
2. Open Patient Access and choose Patient Sign Up. Enter your own email and,
   optionally, your own phone using the country selector. Submit once.
3. Email feedback is intentionally private: it does not disclose whether an email
   already belongs to an eligible account or whether its provider accepted a
   message. Check your own inbox and spam folder. Do not interpret a request
   acknowledgement as delivery.
4. If a phone was supplied, review its separate SMS outcome. “Provider accepted”
   means only transport acceptance, not receipt or verified ownership. If the SMS
   reaches your handset, enter that SMS code and choose **Verify mobile only**.
   Phone proof must not sign you in. To retain the phone during signup, complete
   this optional step before submitting the required email code.
5. If SMS is disabled, unavailable, rejected or uncertain, you can continue with
   email alone. An unverified signup phone is not saved. An accepted SMS without
   entering its code is also not a verified phone.
6. Enter the required email code. A new email account opens profile completion:
   enter your name and give appointment-management consent. A phone verified in
   the prior step should already be shown and retained, not cleared. An existing
   patient opens their existing account without replacing their saved details.
   Onboarding cannot add or replace a phone: email-only signup completes without
   one, and only a saved signup phone is displayed, locked.
7. For resend checks, wait for the displayed timer. Email resend retains the
   original expiry and phone proof. A successful email resend replaces the prior
   email code; unsuccessful resends can leave the prior code valid. Codes expire
   within ten minutes of the original request. SMS resend replaces the previous
   SMS code. Do not repeatedly resend an uncertain message.
8. To check optional-SMS failure without changing delivery policy, leave the
   phone empty or use simulated tests. Never use a random person's number.
9. From an unsigned clinic booking link, choose Patient Sign Up, finish signup
   and profile completion, and confirm return to that same clinic booking.
   Choosing Guest Booking on the access page should also return to that clinic.
10. Sign out and open Patient Login. Email OTP and SMS OTP should remain separate
    choices. SMS login uses a saved, uniquely matching active patient phone; it
    cannot create an account. Shared/unregistered phones should offer email as
    the alternative, not merge identities.
11. Check `/register` and `/sign-up` open signup; `/patient-login` remains login.
    Invitation `/sign-up?ticket=…` links still go to password setup.
12. On a phone-sized screen, use the navigation button and close the drawer with
    Escape. On a keyboard, Tab to the entry choices, switch login channel, submit
    forms and use resend controls. The optional SMS input must not submit or
    invalidate the required email form.

Record separately: (a) simulated tests passed, (b) any displayed provider
acceptance, and (c) your own observation of inbox/handset receipt. Do not put OTPs,
private booking links, phone numbers or email addresses into test reports.
