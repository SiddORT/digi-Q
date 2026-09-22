# ClinicFlow — Complete System Documentation

**Documentation snapshot:** 22 September 2026  
**Product:** ClinicFlow multi-clinic appointment and live-queue application  
**Audience:** administrators, doctors, reception staff, patients, project operators, developers, and future maintainers

## 1. How to use this manual

This manual documents the application that has actually been implemented, rather than presenting the original requirements as completed features. It combines:

- A role-by-role user guide and screen/form reference.
- Backend architecture, business rules, authorization, API behavior, and a database dictionary.
- Setup, administration, development, maintenance, troubleshooting, and release guidance.
- An exact OpenAPI contract appendix for request and response details.

The version-controlled source sections are in `docs/manual/`. The consolidated reference is `docs/ClinicFlow-System-Documentation.md`. A self-contained downloadable HTML edition is provided alongside it, with navigation and print styling.

### Status terminology

| Term | Meaning |
|---|---|
| Implemented | Corresponding application code exists; this is not a claim of successful end-to-end acceptance testing. |
| Verified | A specifically identified check was performed. The scope of that check matters. |
| Pending / not connected | Configuration or functionality is not available in the current build. |
| Recommended | A proposed operational practice or future check, not something already implemented or executed. |
| Development-only | Intended for the preview environment, not a production deployment or real patient information. |

**Important:** This document is a source-based system inventory, not a security certification, compliance opinion, or proof of production readiness. An API contract describes an interface; actual implementation details and limitations are discussed separately.

## 2. Purpose and boundaries

ClinicFlow coordinates multiple clinics and branches, doctors' availability, appointment bookings, token allocation, front-desk processing, and live queue information.

The primary business flow is:

```text
Clinic and branch setup
        ↓
Doctor profile and assignments
        ↓
Weekly availability and date-specific exceptions
        ↓
Patient or staff booking
        ↓
Appointment reference and token
        ↓
Staff check-in and queue processing
        ↓
Patient sees their own queue position and aggregate progress
        ↓
Consultation completion and retained appointment history
```

The app is not an electronic medical record, prescribing platform, billing system, or telemedicine service. No such capability should be inferred from the existence of patient or appointment records.

### Separate authenticated roles

The application does **not** provide a role-switching dropdown. Each authenticated identity is mapped to a stored application role.

| Role | General responsibility |
|---|---|
| Super Admin | Platform-wide administration, users, master data, configuration, and oversight. |
| Clinic Admin | Administration within assigned clinic scope, with no platform-level privilege grant. |
| Doctor | Own professional profile, assigned/owned care locations, availability, appointments, relevant patients, and queue operations. |
| Receptionist | Assigned-location patient registration, appointment booking, check-in, and queue management. |
| Patient | Own profile, booking, appointments, cancellation where allowed, and privacy-limited queue information. |

Detailed permissions and differences between visible navigation and server enforcement appear in the following sections. Hiding a menu item is not the security boundary; the API must authorize the request.

## 3. System at a glance

```text
Browser
  └─ React application + Clerk sign-in + query cache
       ├─ Clerk identity/session service
       └─ Generated REST client → Express API
                                  ├─ Identity-to-role mapping
                                  ├─ Scope and input validation
                                  ├─ Availability / appointment / queue logic
                                  ├─ PostgreSQL transactions and audit records
                                  └─ OTP delivery adapter
                                       ├─ Development code response
                                       └─ Twilio (not connected in this snapshot)
```

- **Frontend:** React and TypeScript, Vite, Wouter routing, TanStack Query, generated API clients, and Clerk authentication components.
- **Backend:** Node.js, Express, TypeScript, request validation, authorization, and transaction-based business operations.
- **Storage:** PostgreSQL with Drizzle; core identities, relationships, statuses, tokens, and scope keys are relational. Some optional fields and configuration are stored as JSONB.
- **Contract:** `lib/api-spec/openapi.yaml`, with generated client and validation packages.
- **Live queue:** periodic polling, not a WebSocket push service.
- **QR codes:** revocable public booking references, not encoded patient records.

## 4. What has actually been checked

During the initial implementation, type checks were reported passing for the shared libraries, API, scripts, and frontend. API and frontend workflows were started successfully. A screenshot confirmed that the public landing page renders.

Subsequently, the preview-account provisioning script passed its TypeScript check and successfully created separate development identities and application profiles for the five roles.

These checks do **not** prove:

- Successful sign-in and complete navigation for every role.
- End-to-end multi-account availability → booking → token → staff queue → patient queue behavior.
- Isolation under malicious cross-clinic requests.
- Correctness under concurrent bookings and queue operations.
- Production SMS delivery, production authentication configuration, or recovery workflows.
- Accessibility compliance, regulatory compliance, backup restoration, or production load capacity.

No full multi-account acceptance test, security certification, or concurrency test has been completed as part of the documented first build. Later sections provide an acceptance checklist, explicitly as work still to perform.

## 5. Current environment and external-service status

### Preview accounts

Five explicit test accounts were created at the user's request after the initial build: Super Admin, Clinic Admin, Doctor, Receptionist, and Patient. They are genuine development authentication accounts with fixed database roles, not a simulated login bypass.

Passwords are deliberately excluded from this manual and from source-controlled documentation. They were supplied separately in the conversation. Do not copy them into source files, public documentation, production configuration, or screenshots.

The test emails use Clerk's `+clerk_test` convention. **For these development test emails only, the email verification code is `424242`**, including the new-device email challenge. This is not the application's mobile OTP and must not be used as a production verification mechanism.

Account creation did not automatically create clinics, branches, doctor schedules, appointments, or clinic assignments. Staff with no assignments will have limited or empty scoped data. Begin with Super Admin to create and assign the desired setup.

### Two separate verification systems

| System | Purpose | Current behavior |
|---|---|---|
| Clerk authentication | Sign-in identity, passwords, email verification, and sessions | Configured for development preview. Test-email challenges use the development convention above. |
| ClinicFlow mobile OTP | Verify the authenticated user's mobile number for applicable booking policy | Explicit development provider is available; it displays a development code and sends no SMS. |

Twilio was proposed but the connection prompt was dismissed. **No real SMS provider is connected in this snapshot.** Production must fail rather than silently accept the development provider.

### Known release boundaries

- Broad notification delivery beyond the implemented OTP adapter and Clerk invitations is not connected.
- A stored session-timeout setting does not change Clerk's actual session lifetime.
- Collection filtering and pagination are largely performed in the API process after reading persisted rows; larger deployments need further database-side optimization.
- Weekly availability supports one session and one optional break per relevant branch/day; overnight sessions are not supported.
- Cross-branch scheduling across different time zones uses conservative overlap checks.
- External identity invitations and local database writes are not one atomic transaction.
- No separate visual wireframe was supplied; the written specification was used as the journey reference.
- Do not put real patient information into the system before appropriate acceptance, security, operational, and legal review.

The later chapters identify finer-grained limitations at the relevant feature.

## 6. Document maintenance

Regenerate the consolidated document after updating its source chapters or the API contract. Treat generated API packages as derived code, not the place to redefine interfaces.

When a feature changes, update its user workflow, permission description, API/schema details, operational instructions, and verification status together. Never change a status from “implemented” to “verified” without naming the check actually performed.

This manual intentionally contains no credentials, environment secret values, live patient records, or claims about an unpublished production environment.