# Same-app published demo

The demo is part of ClinicFlow, not a second deployment. Ordinary account
verification is unchanged. Only the fixed, marked fictional demo identity can
use `/demo-login`; no working email inbox is needed for that identity.

## Activate after publishing

1. Publish the updated application.
2. Sign in normally as Super Admin.
3. Open **Demo clinic**, at `/admin/demo`.
4. Choose **Create demo clinic** and confirm.
5. Save the one-time generated password using the private copy/download controls.
6. Download the QR and copy the sharing message from that page.

Live credentials do not exist until setup runs on the published app. Preview
credentials and the older invitation-based Preview fixture are not live access.
The setup action is idempotent; rotate the password if its one-time response
was lost. Passwords are not stored in application settings or included in the
public sharing message.

## Links on whichever host was used for setup

- Staff: `/demo-login` (demo alias `clinicflow-demo`).
- Clinic and QR: `/clinicflow-demo/main-location`.
- Guest booking: `/clinicflow-demo/main-location?book=1`.
- Website scanner: `/scan-qr`.

One account is both Clinic Admin and doctor. It can operate its existing
clinic's booking/queue/presence workflow but cannot change clinic structure,
create staff or access another clinic. Use only fictional patient details.
Guest requests need staff approval before receiving a token.

Super Admin can disable or rotate access. These actions invalidate existing
demo access; disabling does not delete the fictional clinic or its bookings.
Disable demo access when it is no longer wanted. Changing the domain does not
automatically disable it.

## Verification

Development browser acceptance confirmed explicit creation, fresh inbox-free
demo login, guest request, staff approval/token, and password rotation.
Separate deterministic API checks with exact role identities confirmed setup
idempotency, cross-clinic denial, structural-write denial, existing-session
denial on disable, disabled-login rejection, re-enable, and old-password
rejection after rotation. The final new-password ticket was verified; an
additional provider-session check hit a provider rate limit.

Production setup, production sign-in and physical phone-camera scanning remain
post-publish checks. No production records were created by this implementation.