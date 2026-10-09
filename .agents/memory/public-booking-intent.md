---
name: Public booking intent
description: QR booking remains a patient-facing entry point even for authorized staff.
---

Clinic/location booking QR pages remain patient-facing for every signed-in role,
including staff who legitimately have schedule authority. Do not expose schedule
or doctor-profile management there or probe staff management capability merely
to display booking availability. Keep staff patient-selection and registration
rules unchanged.

**Why:** The user reported a legitimate Doctor or Clinic Admin seeing a schedule
management link inside the patient QR journey. Authority alone does not determine
what belongs in a public booking entry point.

**How to apply:** Preserve shared booking components but make caller intent
explicit. Workspace schedule management still uses server-verified permission;
never change schedule APIs based on the browser URL or referrer. Verify rendered
public routes with staff capability allowed, and distinguish fictional fixture
evidence from real authenticated verification.
