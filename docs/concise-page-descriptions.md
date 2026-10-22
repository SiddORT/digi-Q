# Concise descriptions: route and child-screen checklist

## Reading this checklist

This is an audit of the existing ClinicFlow artifact, not a permission matrix change.
Titles below are the existing titles (retained unless explicitly noted). “None” means
there was no explanatory introduction to shorten; no filler was added. Record names,
addresses, dates, metrics, configuration values and clinical content are data, not
introductions. Status/error/recovery messages remain distinct.

Verification codes: **S** = source and route/child-definition inspection; **R** =
rendered component regression; **B** = representative browser inspection, recorded
in the verification section below. S does not claim a signed-in browser visit.
Changed/unchanged applies to introductory copy, not the underlying functionality.
SA = Super Admin, CA = Clinic Admin, D = Doctor, Rcp = Receptionist, P = Patient.
“Redirect” rows add no new visible introduction. Some role URLs are intentionally
redirect-only or access-restricted, even though registered.

## Registered workspace routes

Each route is listed independently, including linked-only destinations.
Descriptions apply to the destination; child descriptions are enumerated below.

| Route | Role coverage | Existing title | Final brief description | Extra help / disposition | Status / verification |
| --- | --- | --- | --- | --- | --- |
| /admin/dashboard | SA, CA | Configured greeting + first name | Review today’s appointments and recent clinic activity. | No additional page explanation | Changed / S |
| /admin/clinic | SA, CA | Clinic | None; clinic record overview | Clinic details below | Unchanged / S |
| /admin/clinics | SA, CA | Clinic | None; group listing / clinic destination | Existing clinic links and labels retained | Unchanged / S |
| /admin/branches | SA, CA | Locations | None; redirect to clinic Locations | Existing query context retained | Unchanged / S |
| /admin/users | SA, CA | Users | None; SA user administration / CA clinic Staff | Roles, Permissions, System users below | Unchanged / S |
| /admin/staff | SA only | Staff | None; staff listing | Account status help already in icon | Unchanged / S |
| /admin/patients | SA, CA | Patients | None; patient listing | Patient/editor children below | Unchanged / S |
| /admin/masters | SA only | Reference data | None; redirect to Settings Reference data | No new redirect copy | Unchanged / S |
| /admin/appointments | SA, CA | Appointments | None; operational listing | Current filters, dates and recovery retained | Unchanged / S |
| /admin/queue | SA, CA | Queue | None; session context and queue data | Quick switch help shortened below | Changed child / S |
| /admin/reports | SA, CA | Reports | Review visits and outcomes for the selected period. | Four report tabs below | Changed / S |
| /admin/settings | SA, CA | Settings | None; CA redirects to existing destination | Five SA tabs below | Unchanged / S |
| /admin/audit | SA only | Audit log | None; redirect to Settings Audit log | No new redirect copy | Unchanged / S |
| /admin/qrs | SA, CA | Booking QR codes | Check bookable sessions and capacity in Weekly Schedule before sharing a QR. | QR readiness details in icon | Changed / S |
| /admin/book | SA, CA | Book Appointment | None; staged booking labels | Booking steps below; consent remains visible | Unchanged / S |
| /admin/availability | SA, CA | Schedule | Doctor sessions set bookable times; location opening hours are separate. | Capacity/location explanation in icon, opening-hours link retained | Changed / S |
| /admin/exceptions | SA, CA | Schedule | None; Exceptions tab listing | Session-scope help already in icon | Unchanged / S |
| /admin/profile | SA, CA | Profile | None; account data | Profile sections below | Unchanged / S |
| /admin/demo | SA only | Demo clinic | None; redirect to Settings Demo clinic | Fictional-data warning retained | Unchanged / S |
| /admin/templates | SA, CA | Notifications | Configure delivery and wording for appointment, security and onboarding messages. | Existing information icons; activation warnings retained | Unchanged / S |
| /admin/communication | SA only | Communication Settings | None; provider tabs | Email, SMS and Logs below | Changed children / S |
| /admin/permissions | SA only | Roles & Permissions | None; redirect to Users Permissions | Built-in access boundaries retained | Unchanged / S |
| /admin/integrations | SA only | Integrations | None; redirect to Settings Integrations | Existing integration help icon | Unchanged / S |
| /admin/system-users | SA only | System users | None; redirect to Users System users | No new redirect copy | Unchanged / S |
| /doctor/dashboard | D | Configured greeting + first name | Review today’s appointments and recent clinic activity. | No additional page explanation | Changed / S |
| /doctor/profile | D | Profile | None; account data | Existing clinic/schedule links are short | Unchanged / S |
| /doctor/clinics | D | Clinic | None; Clinics, Staff, Booking QR tabs | Network explanation in icon below | Changed child / S |
| /doctor/branches | D | Locations | None; authorized location listing | No new permissions or intro | Unchanged / S |
| /doctor/availability | D | Schedule | Doctor sessions set bookable times; location opening hours are separate. | Capacity/location explanation in icon | Changed / S |
| /doctor/exceptions | D | Schedule | None; Exceptions listing | Existing session-scope icon | Unchanged / S |
| /doctor/appointments | D | Appointments | None; operational listing | Current filters, dates and recovery retained | Unchanged / S |
| /doctor/queue | D | Queue | None; session context and queue data | Operational notes retained | Unchanged / S |
| /doctor/patients | D | Patients | None; authorized patient listing | Registration restriction remains visible | Unchanged / S |
| /doctor/qrs | D | Booking QR codes | Check bookable sessions and capacity in Weekly Schedule before sharing a QR. | QR readiness details in icon | Changed / S |
| /doctor/book | D | Book Appointment | None; staged booking labels | Existing-patient restriction retained | Unchanged / S |
| /doctor/users | D | Staff | None; redirect to Clinic Staff | Staff sections below | Unchanged / S |
| /doctor/settings | D | Settings | None; retired settings redirect | Existing concise destination | Unchanged / S |
| /receptionist/dashboard | Rcp | Configured greeting + first name | Review today’s appointments and recent clinic activity. | No additional page explanation | Changed / S |
| /receptionist/appointments | Rcp | Appointments | None; operational listing | Recovery/actions retained | Unchanged / S |
| /receptionist/queue | Rcp | Queue | None; session context and queue data | Quick switch help below | Changed child / S |
| /receptionist/patients | Rcp | Patients | None; patient listing | Patient/editor children below | Unchanged / S |
| /receptionist/book | Rcp | Book Appointment | None; staged booking labels | Booking steps below | Unchanged / S |
| /receptionist/qrs | Rcp | Booking QR codes | Check bookable sessions and capacity in Weekly Schedule before sharing a QR. | QR readiness details in icon | Changed / S |
| /receptionist/availability | Rcp | Schedule | Doctor sessions set bookable times; location opening hours are separate. | Capacity/location explanation in icon | Changed / S |
| /receptionist/exceptions | Rcp | Schedule | None; Exceptions listing | Session-scope help already in icon | Unchanged / S |
| /receptionist/profile | Rcp | Profile | None; account data | Existing profile fields retained | Unchanged / S |
| /receptionist/settings | Rcp | Settings | None; retired settings redirect | Existing concise destination | Unchanged / S |
| /patient/dashboard | P | Configured greeting + first name | Review your appointments and booking confirmations. | No additional page explanation | Changed / S |
| /patient/book | P | Book Now | None; staged booking labels | Booking steps below | Unchanged / S |
| /patient/appointments | P | Appointments | None; appointment history/listing | Private ticket/record actions retained | Unchanged / S |
| /patient/queue | P | My Queue | None; own queue data | No staff actions exposed | Unchanged / S |
| /patient/profile | P | Profile | None; account data | Your Visit Records description retained below | Unchanged / S |
| /patient/settings | P | Settings | None; retired settings redirect | Existing concise destination | Unchanged / S |

## Public, authentication and alternate routes

| Route | Role coverage | Existing title | Final brief description | Extra help / disposition | Status / verification |
| --- | --- | --- | --- | --- | --- |
| / | Public; signed-in redirect | A Healthier Way to Manage Your Next Visit. | Find a clinic, book a visit and follow your queue. | QR/Guest Booking entry instructions in icon | Changed / S |
| /guest-booking | Public | Guest Booking | Choose a clinic and location to book a visit. | Review session and sole-option default in icon | Changed / S |
| /scan-qr | Public | Scan a Clinic Booking QR Code | Scan your clinic’s QR code to book a visit. | Review context / phone camera alternative in icon | Changed / S |
| /check-in | Authorized staff only | Validate Appointment QR | Scanning only verifies the ticket. | Explicit consultation check-in instruction retained | Unchanged / S |
| /display/:reference | Public | Location name / queue display | None; actual location and queue data | Revoked/offline/empty states and booking link retained | Unchanged / S |
| /book/:reference | Public, signed-in patient-facing entry | Clinic name / Book a Visit | None; actual clinic/location/doctor context | Booking stages, demo warning retained | Unchanged / S |
| /:clinicSlug | Public | Clinic name | Choose a location to see its care team, booking and reception display. | Directory cards contain real names/addresses | Unchanged / S |
| /:clinicSlug/:branchSlug | Public | Location / clinic name | None; actual address and contact data | Care team, booking, display, hours below | Unchanged / S |
| /sign-in/*? | Public staff entry | Staff Login | Use your DigiQ staff email and password. | Register-clinic linked card remains brief | Unchanged / S |
| /sign-up/*? | Public | Redirect | None; invitation to Set Password or Patient Login | No new visible copy | Unchanged / S |
| /patient-login | Public patient entry | Patient Login | Enter your mobile number or email to request a one-time login code. | Eligibility/provider-acceptance result remains visible | Unchanged / S |
| /demo-login | Public demo entry | Demo Clinic Login | Explore the fictional clinic with its dedicated demo account. | Real-patient-data warning stays visible separately | Changed / S |
| /register-clinic/*? | Public new owner; SA setup | Register a Clinic | Create a verified owner account for your clinic. | Subsequent setup explanation in icon | Changed / S |
| /register-doctor | Public | Already invited? | Healthcare providers need an invitation from their clinic administrator. | Existing-account sign-in instruction in icon | Changed / S |
| /onboarding | Signed-in | Welcome to your care workspace. | Complete your patient profile to get started. | Consent remains visible | Changed / S |
| /onboarding (provider intent) | Signed-in | Care begins with an invitation. | Ask your clinic administrator for a staff invitation. | No self-registration authorization added | Changed / S |
| /forgot-password | Public staff entry | Reset Staff Password | Request a reset link for your active staff account. | Eligible-account/single-use explanation in icon; nondisclosing result retained | Changed / S |
| /reset-password | Public staff entry | Redirect | None; token-aware Set Password / Forgot Password destination | No new visible copy | Unchanged / S |
| /set-password | Public invitation/reset | Set your staff password / Reset your staff password | Choose a secure password, then sign in from the staff login page. | Password rules, incomplete/expired link recovery retained | Unchanged / S |
| /login | Public | Redirect | None; Staff Login destination | No new visible copy | Unchanged / S |
| /register | Public | Redirect | None; Patient Login destination | No new visible copy | Unchanged / S |
| /admin | SA, CA | Redirect | None; admin dashboard destination | Guard unchanged | Unchanged / S |
| /doctor | D | Redirect | None; doctor dashboard destination | Guard unchanged | Unchanged / S |
| /receptionist | Rcp | Redirect | None; receptionist dashboard destination | Guard unchanged | Unchanged / S |
| /patient | P | Redirect | None; patient dashboard destination | Guard unchanged | Unchanged / S |
| /admin/doctors | SA; CA existing guard | Redirect | None; Staff Doctors destination | Guard unchanged | Unchanged / S |
| unmatched route | Everyone | Page Not Found | This page is unavailable. | Return Home retained | Changed / S |
| /admin/clinics/:clinicId/:section? | SA, CA only | Clinic + actual clinic name | None; record overview and selected section | Every section enumerated next | Changed children / S |

## Nested clinic and record surfaces

These are actual child definitions, not additional public routes. Role access stays
the enclosing route's access and API permissions; listing a child here does not grant access.

| Child destination / existing title | Roles | Final description or retained data | Additional help / protected copy | Status / verification |
| --- | --- | --- | --- | --- |
| Clinic > Details | SA, CA | None; name, code, metadata, contacts and hours | Opening hours/linked schedule information is operational | Unchanged / S |
| Clinic > Locations | SA, CA | None; location listing | QR subsection below | Unchanged / S |
| Clinic > Staff | SA, CA | None; category listing | All-staff link retained | Unchanged / S |
| Clinic > Policies | SA, CA | None; saved policy values | Policy-vs-platform help icon; notification caveat retained | Unchanged / S |
| Clinic > Activity History | SA, CA | None; scoped audit events | SA platform audit link retained | Unchanged / S |
| Clinic > Booking links & QR | SA, CA | Regenerating a QR invalidates printed copies. | Existing hours/link help; consequential warning remains visible | Unchanged / S |
| Clinic > Edit clinic | SA, owning CA | None; edit fields | URL permanence, ownership locks, metadata limits retained | Unchanged / S |
| Clinic > Edit Policies | SA, owning CA | None; policy fields | Booking/verification limits retained | Unchanged / S |
| Clinic > Edit location / contacts | SA, owning CA | None; location values | Inheritance, existing no-hour-limit warning retained | Unchanged / S |
| Clinic > Copy opening hours | SA, owning CA | Destination location and draft-replacement warning | Review impact and copy exclusions are consequential | Unchanged / S |
| Clinic > Date and Time Format | SA, owning CA | Actual date/time preview | Display-only change and confirmation retained | Unchanged / S |
| Clinic > Enable My Doctor Profile / Manage Clinical Locations | CA | Choose active owned locations where you consult. | At least one active location requirement stays visible | Unchanged / S |
| Doctor Clinic > Clinics > Currently Assigned Clinics | D | Clinics where you actively practice and manage appointments. | Actual authorized cards and actions | Unchanged / S |
| Doctor Clinic > Clinics > Clinics in Your Network | D | Browse clinics managed by your administrator. | Assignments, contact admin, network search/sort in icon | Changed / S |
| Doctor Clinic > Staff | D | None; receptionist listing | No doctor/admin tab exposed | Unchanged / S |
| Doctor Clinic > Booking QR | D | Check bookable sessions and capacity in Weekly Schedule before sharing a QR. | Readiness detail in icon | Changed / S |
| Staff > Clinic Admins category | SA | None; actual staff listing | Setup card next | Unchanged / S |
| Staff > Doctors category | SA, CA | None; actual staff listing | Scoped schedule action retained | Unchanged / S |
| Staff > Receptionists category | SA, CA, D | None; actual staff listing | Existing permitted actions retained | Unchanged / S |
| Staff > Clinic Admin Setup | SA | Create a new clinic and its owner account. | Setup detail in icon; no ownership transfer remains visible | Changed / S |
| Staff > Add Staff / Edit staff | SA, CA, D scoped | Choose a role, then enter the shared details and assignments. | Dirty/role-switch confirmation untouched | Unchanged / S |
| Staff > Staff details | SA, CA, D scoped | Sign-in identity and professional registration / invitation email. | No duplicated invitation sentence | Changed / S |
| Staff > Professional | SA, CA scoped | Registration and experience. | Real fields retained | Unchanged / S |
| Staff > Assignments / Assignment | SA, CA, D scoped | Which Clinic Groups and locations this person works at. | Assignment and inherited-default constraints retained | Unchanged / S |
| Staff receptionist > Personal tab | SA, CA, D scoped | Sign-in identity and invitation email. | Fields remain mounted | Changed / S |
| Staff receptionist > Assignment tab | SA, CA, D scoped | Which Clinic Groups and locations this person works at. | Existing scope constraints | Unchanged / S |
| Staff > Inherited clinic summary | SA, CA, D scoped | Doctor sessions are not copied; configure them in Schedule. | Linked/custom sessions and capacity setup in icon | Changed / S |
| Staff > Account Recovery Assistance | SA, CA | Find staff recovery steps without sending email. | Actions/results retained | Changed / S |
| Staff > Permanent removal / visit handoff / clinic handoff / history reconciliation | SA | Safety review, actual impact and explicit confirmations | Consequential warnings and delete text NOT hidden | Unchanged / S |
| Patient details > Timeline | Existing record access | None; actual appointments | Own-record and staff permissions unchanged | Unchanged / S |
| Patient details > Activity | Existing record access | Actual count of status changes across all visits | Loading/empty/error states retained | Unchanged / S |
| Patient details > Documents | Existing record access | None; real private documents | Upload/download/delete confirmations retained | Unchanged / S |
| Patient editor > Personal & Contact | Existing create/edit access | Identity and booking contacts. | Name/contact/sign-in rules retained | Unchanged / S |
| Patient editor > Additional Details | Existing create/edit access | Address and optional emergency contact sections | Fields retained | Unchanged / S |
| Patient editor > Patient information | Existing create/edit access | Identity and booking contacts. | Contact/notification distinction retained | Unchanged / S |
| Patient editor > Clinic and status | Existing create/edit access | Where this record is managed. | Status explanation already in icon | Unchanged / S |
| Patient editor > Address | Existing create/edit access | Used for communication and location. | Real address fields | Unchanged / S |
| Patient editor > Emergency contact | Existing create/edit access | Optional person to call about this patient. | Fields retained | Unchanged / S |
| Location editor > Identity | Existing owner/edit access | None; actual identity/timezone fields | Ownership restrictions remain visible | Unchanged / S |
| Location editor > Address | Existing owner/edit access | Used for communication and location. | Fields retained | Unchanged / S |
| Location editor > Contact | Existing owner/edit access | Public contact details for this location. | Independent inheritance toggles retained | Unchanged / S |
| Location editor > Status | Existing owner/edit access | None; actual status field | Consequences retained | Unchanged / S |
| Generic editor > Details | Existing create/edit access | None; actual record fields | No filler added | Unchanged / S |
| Generic editor > Address | Existing create/edit access | Used for communication and location. | Fields retained | Unchanged / S |
| Generic editor > Professional | Existing create/edit access | Shown to patients when booking. | Fields retained | Unchanged / S |
| Generic editor > Assignment and scope | Existing create/edit access | Which clinics and locations this applies to. | Restrictions retained | Unchanged / S |
| Generic editor > Day | Existing create/edit access | None; actual day/date fields | Exception rules retained | Unchanged / S |
| Generic editor > Timing | Existing create/edit access | Session hours and an optional break. | Validation/warnings retained | Unchanged / S |
| Generic editor > Capacity | Existing create/edit access | Tokens and pacing for this session. | Actual capacity data retained | Unchanged / S |
| Generic editor > Queue window | Existing create/edit access | When walk-ins and check-ins are accepted. | Field definitions retained | Unchanged / S |
| Generic editor > Verification and links | Existing create/edit access | None; actual verification/policy fields | Rules retained | Unchanged / S |
| Generic editor > Status | Existing create/edit access | None; actual account/record status | Consequences retained | Unchanged / S |
| Generic user editor > Personal | Existing create/edit access | None; grouped identity fields | Real fields retained | Unchanged / S |
| Generic user editor > Assignment | Existing create/edit access | Which clinics and locations this applies to. | Scope restrictions retained | Unchanged / S |
| Profile > Your Visit Records | P | View your appointment history, status changes and documents shared by your clinic. | Own-record capabilities unchanged | Unchanged / S |
| Profile > Account / professional / address sections | Existing signed-in role | Same generic editor section hints above | Actual profile data and inactive-doctor warning retained | Unchanged / S |

## Scheduling, queue, booking and appointment children

| Child destination / existing title | Roles | Final brief description / data | Extra help / protected copy | Status / verification |
| --- | --- | --- | --- | --- |
| Schedule > Weekly | SA, CA, D, Rcp scoped | Doctor sessions set bookable times; location opening hours are separate. | Capacity/location explanation in icon | Changed / S |
| Schedule > Exceptions | SA, CA, D, Rcp scoped | None; actual exception listing | Existing timing/scope help | Unchanged / S |
| Schedule editor > Schedule | Existing edit access | One session for this doctor, clinic and weekday. | Fresh assignments / locked linked sessions retained | Unchanged / S |
| Schedule editor > Timing & Break | Existing edit access | Session hours and an optional break. | Conflict/outside-hours warnings remain visible | Unchanged / S |
| Schedule editor > Capacity | Existing edit access | Tokens and pacing for this session. | Fields retained | Unchanged / S |
| Schedule editor > Queue Settings | Existing edit access | Optional queue times control when walk-ins and check-ins are accepted. | Operational field help retained | Unchanged / S |
| Weekly editor > days / sessions / copy week / Follow location hours | Existing edit access | Actual week/session summaries | Draft replacement, linked locks and outside-hours warnings retained | Unchanged / S |
| Doctor schedule context > Date Exceptions | Existing edit access | None; actual exceptions | Retry/add/edit actions retained | Unchanged / S |
| Exception editor > Day / Timing / Capacity | Existing edit access | Same concise generic section hints above | Reason, all-session closure and timing restrictions retained | Unchanged / S |
| Queue > multi-doctor quick switch | SA, CA, Rcp scoped | Choose a doctor’s queue for this location and date. | Session selection in icon; no call/check-in warning visible | Changed / S |
| Queue > duration / notes / guest requests | Existing operational access | Actual session/visit data | Future-only/running impact and request warnings retained | Unchanged / S |
| Booking > Visit | Staff, P, public QR | None; selection stage labels | Actual clinic/doctor/session context retained | Unchanged / S |
| Booking > Patient details | Staff, P, public QR | Who is this visit for? | Contact permission and guest no-account rules visible | Unchanged / S |
| Booking > Review | Staff, P, public QR | Everything look right? | Real summary, cancellation cutoff, consent and immediate-ticket semantics visible | Unchanged / S |
| Booking > Schedule setup | Existing staff edit access | Saved sessions apply to matching weekdays. | Exceptions/restrictions and retained booking draft remain visible | Unchanged / S |
| Booking > discovery / no sessions / next dates | Existing booking access | Date-specific session results and search bounds | No “no weekly schedule” inference; limits and recovery retained | Unchanged / S |
| Booking > confirmation / private ticket / receipt management | Existing private receipt access | Actual visit/token/status | No-double-book warning and receipt restrictions retained | Unchanged / S |
| Appointment > details / timeline / ticket | Existing appointment access | Actual appointment data | QR privacy and explicit check-in warning retained | Unchanged / S |
| Appointment > reschedule / movement / cancellation / bulk actions | Existing operational access | Actual current and destination session data | Token/call release, irreversible cancellation and partial-result warnings retained | Unchanged / S |
| Appointment > ticket email / export | Existing access | Confirm each recipient. | Eligibility, complete export, privacy and delivery warnings retained | Unchanged / S |
| Check-in > inline scanner / validation / confirm | Authorized staff only | Scanning only verifies the ticket. | Explicit check-in, stale/offline warnings retained | Unchanged / S |

## Settings, users and notifications children

| Child destination / existing title | Roles | Final brief description / data | Extra help / protected copy | Status / verification |
| --- | --- | --- | --- | --- |
| Settings > Platform / Platform Preferences | SA | Platform-wide booking, verification and policy-link defaults. | Integration/session-limit disclosure remains optional | Unchanged / S |
| Settings > Integrations / Third-Party Integrations | SA | None; provider status | Existing encrypted/source-replacement icon | Unchanged / S |
| Integrations > SMTP | SA | Email configuration, diagnostics and test email are in Communication → Email Settings. | Link retained, no nested info trigger | Unchanged / S |
| Integrations > SMS / Twilio credentials drawer | SA | Saving does not send a message. | Security-vs-optional provider distinction retained | Unchanged / S |
| Integrations > Storage | SA | Server environment only; not editable here. | Existing storage variable explanation in icon | Unchanged / S |
| Settings > Reference data | SA | None; actual master values | Category filter and record editor retained | Unchanged / S |
| Settings > Audit log | SA | None; actual audit events | Payload drawer retained | Unchanged / S |
| Settings > Demo clinic / Published Demo Clinic | SA | None; actual setup status | Existing info, credentials privacy, fictional-data warnings retained | Unchanged / S |
| Users > Roles / Custom Roles | SA | None; actual custom role listing | Existing scope/restriction icon | Unchanged / S |
| Users > Permissions / Access Rules | SA | None; actual action matrix | Existing built-in boundary icon and read-only SA warning | Unchanged / S |
| Users > System users | SA | None; actual system accounts | Status counts/actions retained | Unchanged / S |
| Users > role editor / assignments | SA | Changes apply to the draft. | Publish/immediate effect and assignment consequences remain visible | Unchanged / S |
| Users > Effective Permissions drawer | SA | Actual role/email/scope | “Not restricted” is not an access grant; visible | Unchanged / S |
| Communication > SMS Settings | SA | None; provider configuration fields | Security boundary remains visible | Changed children / S |
| SMS > Keep in Touch | SA | Configure the Keep in Touch sender and credentials. | Request/response contract in icon; required credentials, acceptance/activation warning visible | Changed / S |
| SMS > Custom API mapping | SA | Map your provider’s HTTPS POST request. | Mapping mechanics in icon; unpolled status URL limitation visible | Changed / S |
| SMS > compatibility provider editor | SA | Map a plain HTTPS POST request for your provider. | Protocol/compatibility detail in icon | Changed / S |
| SMS > provider correction / test / save confirmation | SA | Actual saved/draft/readiness state | Credential preservation, no send, uncertainty warnings visible | Unchanged / S |
| Communication > Email Settings | SA | None; SMTP fields | Optional-vs-security boundary visible | Unchanged / S |
| Email > Diagnostics | SA | Check the saved email connection without sending mail. | Saved-only/on-request/cleared-results in icon; no delivery assurance visible | Changed / S |
| Email > test / receipt assertion / password confirmation | SA | Actual configuration-bound test outcome | Provider acceptance, manual assertion limits and no-send save warning visible | Unchanged / S |
| Communication > Notification Logs | SA | Read-only log data and timezone | Delivery unknown, legacy and retained-history limitations visible | Unchanged / S |
| Logs > record details / timeline | SA | Actual channel/recipient/status data | Legacy/unavailable and provider-error notices visible | Unchanged / S |
| Notifications > event groups | SA, CA authorized scope | Actual event/channel/recipient options | Group switches, filtered-out rows, future-only/no-replay operational guidance retained | Unchanged / S |
| Notifications > booking / rescheduled / cancelled / completed / reminder | SA, CA authorized scope | No additional page introduction | Row previews, activation and templates retained | Unchanged / S |
| Notifications > patient_login_otp / patient_email_otp / registration_mobile_otp / clinic_registration_otp | SA security scope | No additional page introduction | Security locks, readiness and activation restrictions visible | Unchanged / S |
| Notifications > onboarding / doctor_setup / staff_setup / password_setup_complete | Existing authorized scope | No additional page introduction | Onboarding event wording and security boundary retained | Unchanged / S |
| Notifications > Edit Template / preview / test / reset / publish | Existing authorized scope | Actual event · channel · recipient | Required placeholders, DLT, unsaved/publish/test warnings retained | Unchanged / S |
| Booking Mail Outcomes linked view | SA, owning CA | Recorded owner booking emails only. | Read-only, no-send, no-replay and no-delivery-proof limits retained | Unchanged / S |

## Reporting children and linked entry cards

| Child destination / existing title | Roles | Final brief description | Extra help / protected copy | Status / verification |
| --- | --- | --- | --- | --- |
| Reports > Live Reports | SA, CA | Review visits and outcomes for the selected period. | No second shell intro; filters/metrics/Views/export unchanged | Changed / S |
| Reports > Report Templates | SA, CA | Open a live report or reuse a saved configuration. | Family-opening/current-access explanation in adjacent icon | Changed / S, R |
| Report Templates > Saved Custom Configurations | SA, CA | No saved configurations yet. (empty only) | Views instructions and relative-period reevaluation in section icon; real saved names/filters/open/delete/retry preserved | Changed / S, R |
| Report Templates > Report Families | SA, CA | None; labeled entry cards | All family entry points remain present | Unchanged / S, R |
| Family > Daily Appointment Summary | SA, CA | Visits and outcomes for every day, clinic or doctor in range. | Open Report retained | Unchanged / S, R |
| Family > Doctor Utilization | SA, CA | Visits, unique patients and consultation time per doctor. | Open Report retained | Unchanged / S, R |
| Family > No-show Analysis | SA, CA | Where absent visits concentrate, against total visits. | Open Report retained | Unchanged / S, R |
| Family > Patient Registration | SA, CA | New patient registrations and the patients seen. | Open Report retained | Unchanged / S, R |
| Family > Cancellation | SA, CA | Cancelled visits against the visits booked. | Open Report retained | Unchanged / S, R |
| Family > Clinic Activity | SA, CA | Recorded workspace activity for the selected scope. | Open Report retained | Unchanged / S, R |
| Family > Reschedules | SA, CA | Visits moved to another date or session. | Open Report retained | Unchanged / S, R |
| Family > Clinic Performance | SA, CA | Waiting, consultation and completion figures per clinic. | Open Report retained | Unchanged / S, R |
| Family > Patient Activity | SA, CA | Unique patients and their visit activity. | Open Report retained | Unchanged / S, R |
| Family > Communication Usage | SA, CA; restriction for other callers | Observed email and SMS activity, not proof of delivery or billing. | Access boundary and action retained | Changed / S, R |
| Reports > Operational Detail | SA, CA | Review visits and outcomes for the selected period. | Methodology already in icon; table/trends/export retained | Changed / S |
| Reports > Communication Usage | SA, CA | Actual observed usage and coverage limits | Counts are not billing/delivery, best-effort history and attribution limitations remain visible | Unchanged / S |
| Usage > record / breakdown / full export | SA, CA scoped | Read-only metadata. | Message content/privacy, partial legacy and attribution caveats visible | Unchanged / S |
| Reports > details drawer | SA, CA scoped | Actual family · clinic · date | Metrics, nulls and no-data distinctions retained | Unchanged / S |

## Registration, public sections and cross-cutting surfaces

| Child destination / existing title | Roles | Final brief description | Extra help / protected copy | Status / verification |
| --- | --- | --- | --- | --- |
| Registration account > details | New owner | Create a verified owner account for your clinic. | Next setup steps in icon; existing-account restriction visible | Changed / S |
| Registration account > review | New owner | Check your details before we send your verification code. | Actual name/contact/review data and resend results retained | Unchanged / S |
| Registration account > verify | New owner | Same account heading; current verification state | Expiry/attempts/storage notices retained | Unchanged / S |
| Registration > Clinic identity | New owner / SA | Name your clinic and choose its public address. | Public identity/permanent URL explanation in icon; permanence warning visible by URL field | Changed / S |
| Registration > Locations | New owner / SA | Add the locations where your team provides care. | One-owner/address/timezone explanation in icon; actual location controls retained | Changed / S |
| Registration > Opening hours | New owner / SA | Set opening hours for each location. | Doctor-session distinction in icon and later visible readiness warning | Changed / S |
| Opening-hour entry | Existing authorized editor | Set the opening intervals for each day. | Slider mechanics in icon; overnight/copy-replacement warnings visible | Changed / S |
| Registration > Your practice | New owner / SA | Choose whether the owner also consults at this clinic. | Same-account explanation in icon; sole-admin and linked/custom behavior visible | Changed / S |
| Registration > Care team | New owner / SA | Plan your team invitations after setup. | Staff-management instructions in icon; no invitations sent from this step visible | Changed / S |
| Registration > Review | New owner / SA | Review your clinic details before saving. | Atomic setup explanation in icon; real draft data, URL permanence and sessions warning retained | Changed / S |
| Registration > Completion | New owner / SA | Review your saved clinic setup before sharing booking links. | Same-account/configuration explanation in icon; readiness/linked-session limits and invitation outcome visible | Changed / S |
| Registration > already registered / existing account | Existing signed-in user | Open your saved workspace / existing role will not change. | No duplicate clinic retry; existing recovery actions retained | Unchanged / S |
| Auth shell | Public | None; decorative brand heading only | Duplicate generic appointments intro removed | Changed / S |
| Auth access > Staff Password Required | Signed-in unverified staff | Current session requires staff-password verification. | Sign-out/sign-in recovery remains visible | Unchanged / S |
| Home > Find Your Care | Public | Choose a clinic, location and doctor that work for you. | Actual linked booking entries remain available | Unchanged / S |
| Home > Plan Your Visit | Public | See actual availability and reserve your appointment. | No extra tutorial | Unchanged / S |
| Home > Skip the Uncertainty | Public | Check your token and live queue before you arrive. | No extra tutorial | Unchanged / S |
| Home > For clinics | Public | One workspace for your clinics, appointments, schedules and patient flow. | Register a Clinic link retained | Unchanged / S |
| Public clinic > care team | Public | None; actual doctor profiles | Doctor about/specialization/duration are substantive data, not hidden | Unchanged / S |
| Public clinic > opening hours | Public | Actual timetable and timezone | Hours do not guarantee doctor availability warning retained | Unchanged / S |
| Public clinic > live display / book mode | Public | Actual token-only queue / clinic context | Offline/revoked states and booking actions retained | Unchanged / S |
| Sidebar / profile menu / favorites / recent links | Existing signed-in role | Existing concise navigation names | No nested information triggers or gratuitous link icons added | Unchanged / S |
| Sidebar > live updates | Existing signed-in role | Live queue updates / Bookings update automatically. | Reconnect/refresh explanation in icon | Changed / S |
| Workspace search | Existing signed-in role | Enter two characters to search records. | Device-only favorites/recent and no saved patient/search terms in icon | Changed / S |
| Columns drawer | Existing listing access | Choose, order and pin your visible columns / Choose which columns to show. | Pinning/layout/hidden-values mechanics in icon | Changed / S, R |
| Saved Views drawer | Existing listing access | Save and reuse your filters and column layout. | Sync/structured settings/no search storage in icon | Changed / S, R |
| Views > On This Device Only | Existing listing access | Import older views from this device. | Import mechanics in icon | Changed / S |
| Listing empty / filtered empty | Existing listing access | No records yet / existing contextual no-matches message | Removed redundant “When added, you'll find them here” filler; Clear Filters / Clear Search / Add actions preserved | Changed / S, R |
| Loading / stale / failed / partial-result states | Existing access | Actual loading/error/outcome text | Retry, dismiss, refresh and results retained; not hidden by CSS | Unchanged / S |
| Confirmations / consent / destructive dialogs | Existing authorized access | Consequences and required confirmation remain visible | Not treated as optional help | Unchanged / S |

## Verification

- Source audit: `App.tsx` route definitions; `clinic.tsx` workspace dispatch and
  legacy destinations; clinic section definitions; workspace/report/provider
  tabs; `lib/form-tabs.ts`; resource/editor groups; staff sections; registration
  steps; patient detail tabs; notification event/editing surfaces.
- This checklist is checked against every registered workspace route by
  `concise-descriptions.test.mjs`. Component rendering verifies exact report copy,
  supplementary help descriptions, all family cards, saved data/actions, and
  loading/error/empty distinctions. Existing report and workspace regressions
  cover saved/filter/navigation behavior.
- Browser verification (2026-10-22): Guest Booking, Forgot Password and provider
  invitation entry rendered at desktop and 390×844. Intros were readable and
  wrapped without horizontal clipping; guest text measured 5.91:1 contrast.
  Hover, keyboard focus, Escape, second-touch toggle and outside-touch dismissal
  passed. A compatibility-mouseenter reopen after an outside touch was found and
  fixed with a small pointer-hover guard in the existing HelpTip. The targeted
  follow-up waited for compatibility events to settle and confirmed the tip
  stayed closed. Moving between report and saved-configuration help left one
  visible bubble, with no native-title duplicate.
- Read-only browser fixtures rendered Report Templates (exact title/subtitle,
  nine families plus Communication Usage, saved-empty/loading/retry states),
  Platform Preferences, the staff listing and Columns drawer, and
  doctor/receptionist/patient dashboard/profile shells. No business records,
  providers, notifications or saved views were changed.
- Genuine browser limitations: secrets were not available in the delegated
  browser, so signed-in checks used browser-only response interception, not real
  authentication. They do not prove current role permissions or live-data
  behavior. Minimal role fixtures also produced unavailable location/metric
  states. The staff fixture exposed no Saved Views control; that description is
  covered by component/source regression rather than a drawer interaction.
  Narrow-width live signed-in screenshots were not established for every role
  or child screen. S-only rows are not individually browser-tested.
- Final targeted regression batch: **39 passing tests**, across
  `concise-descriptions.test.mjs`, `information-density-pages.test.mjs`,
  `workspace-surfaces.test.mjs`, `clinic-navigation.test.mjs` and
  `reports/reports.test.mjs`. An existing staff-link source assertion was updated
  to recognize the current canonical navigation helper, without changing routes.
- Production build passed with the artifact's PORT and BASE_PATH. Shared types
  built successfully. The full frontend typecheck still reports the pre-existing
  Vite plugin type mismatch at `vite.config.ts` lines 54–55 (different resolved
  yaml peer instances); no app-source type errors remain. The separate dependency
  repair is not hidden by casts or typecheck suppression.
