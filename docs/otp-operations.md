# Mobile verification

ClinicFlow authentication uses Clerk. Mobile verification is a separate, authenticated challenge bound to the current ClinicFlow account, not a substitute for signing in.

## Development

`OTP_PROVIDER=development` is configured in the development environment only. It is effective only when `NODE_ENV=development`. The response includes a clearly labelled development code. This exercises expiry, resend cooldown, attempt limits and single-use verification without sending an SMS. It does not prove ownership of a phone number.

Never enable development verification on a publicly used deployment. Production rejects this provider and never returns codes.

## Production SMS

Connect the Twilio integration, provision an appropriate Twilio Messaging Service with an approved sender, and configure these non-secret environment values for production:

- `OTP_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_MESSAGING_SERVICE_SID`

Twilio credentials are managed by the integration; do not put them in source code. Sender registration, regional permissions and delivery restrictions must be satisfied by the provider account. The application reports an error when delivery is unavailable; it does not silently verify users or substitute development delivery.

`SESSION_SECRET` is required to protect stored challenge digests. Codes expire according to platform settings, can be requested at most once per minute and five times per account per hour, and become unusable after consumption, expiry or the configured attempt limit. A newer challenge invalidates prior challenges. Challenge attempts and successful verification are committed transactionally.

The SMS provider has not been connected or live-delivery tested in this build. Before using real patient data, verify provider delivery, account recovery, access boundaries and the full multi-account queue workflow.