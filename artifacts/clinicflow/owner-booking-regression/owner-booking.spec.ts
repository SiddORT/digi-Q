import { expect, test, type Page, type TestInfo } from "@playwright/test";

const BASE_URL = process.env.OWNER_BOOKING_BASE_URL;
const PASSWORD = process.env.OWNER_BOOKING_PASSWORD || "Fictional-Owner!2026";
const SUPER_EMAIL = process.env.OWNER_BOOKING_SUPER_EMAIL || "super@owner.test.invalid";
const SUPER_PASSWORD = process.env.OWNER_BOOKING_SUPER_PASSWORD || PASSWORD;

type Evidence = {
  users: any[];
  doctors: any[];
  assignments: any[];
  branches: any[];
  patients: any[];
  appointments: any[];
  mail: Array<{ to: string; subject: string; text: string; html?: string }>;
};

async function readEvidence(page: Page): Promise<Evidence> {
  const response = await page.request.get("/api/__owner-booking-evidence");
  expect(response.status(), "read-only owner evidence endpoint").toBe(200);
  return response.json();
}

async function signIn(page: Page, email: string, password: string, ownerName?: string) {
  await page.goto("/sign-in");
  await page.getByTestId("input-staff-email").fill(email);
  await page.getByTestId("input-staff-password").fill(password);
  await page.getByTestId("button-staff-login").click();
  await expect(page.getByTestId("button-profile-menu")).toBeVisible();
  if (ownerName) await expect(page.getByTestId("button-profile-menu")).toContainText(ownerName);
}

async function signOutToStaffLogin(page: Page) {
  await page.getByTestId("button-signout").click();
  const staffLogin = page.getByRole("link", { name: "Staff Login" });
  await staffLogin.waitFor({ state: "visible", timeout: 15_000 });
  await staffLogin.click();
}

async function fillOwnerWizard(
  page: Page,
  options: {
    clinicName: string;
    ownerName: string;
    ownerEmail: string;
    clinicEmail: string;
    superAdmin: boolean;
    password?: string;
  },
) {
  if (options.superAdmin) {
    await page.getByTestId("registration-fullName").fill(options.ownerName);
    await page.getByTestId("registration-email").fill(options.ownerEmail);
  }
  await page.getByTestId("registration-name").fill(options.clinicName);
  await page.getByTestId("registration-clinicEmail").fill(options.clinicEmail);
  await page.getByRole("textbox", { name: "Clinic Group phone (optional)" }).fill("9876543210");
  await page.getByTestId("registration-next").click();

  await page.getByTestId("registration-branch-0-name").fill(
    options.superAdmin ? "Fictional Admin Main" : "Fictional Self Main",
  );
  await page.getByTestId("registration-branch-0-address").fill("Fictional Road");
  await page.getByTestId("registration-next").click();

  await page.getByTestId("hours-open-1").click();
  await page.getByTestId("hours-startTime-1-0").fill("9:00 AM");
  await page.getByTestId("hours-endTime-1-0").fill("6:00 PM");
  await page.getByTestId("registration-next").click();

  await page.getByTestId("registration-also-consult").check();
  await page.getByTestId("registration-link-hours").check();
  await page.getByTestId("registration-session-capacity").fill("20");
  await page.getByRole("button", { name: "Expected Consultation Duration" }).click();
  await page.getByRole("option", { name: "20 minutes", exact: true }).click();
  await page.getByTestId("registration-next").click();
  await page.getByTestId("registration-next").click();

  if (options.password && (await page.getByTestId("registration-confirm-password").count())) {
    await page.getByTestId("registration-confirm-password").fill(options.password);
  }
  await page.getByTestId("registration-next").click();
  await expect(page.getByRole("heading", { name: `${options.clinicName} is registered.` })).toBeVisible();
}

async function ownerFromMe(page: Page) {
  const response = await page.request.get("/api/me");
  expect(response.status()).toBe(200);
  const me = await response.json();
  const user = me.user || me;
  const doctorId = me.doctorId || user.doctorId;
  const clinicId =
    me.clinicId ||
    user.clinicId ||
    me.clinicIds?.[0] ||
    user.clinicIds?.[0];
  expect(user.role || me.role).toBe("clinicAdmin");
  expect(doctorId).toBeTruthy();
  expect(clinicId).toBeTruthy();
  return { me, user, doctorId, clinicId };
}

async function verifyRealOwnerDirectory(
  page: Page,
  clinicName: string,
  branchName: string,
  ownerName: string,
  previousOwnerName?: string,
) {
  const { me, user, doctorId, clinicId } = await ownerFromMe(page);
  const evidence = await readEvidence(page);
  const doctorRecord = evidence.doctors.find(
    (doctor) => doctor.id === doctorId || doctor.data?.id === doctorId,
  );
  expect(doctorRecord, "persisted doctor profile for the authenticated owner").toBeTruthy();
  expect(doctorRecord.user_id).toBe(user.id);
  expect(doctorRecord.owner_admin_id).toBe(user.id);
  const doctorData = doctorRecord.data || doctorRecord;
  const branchIds: string[] =
    doctorData.branchIds || me.branchIds || user.branchIds || [];
  expect(branchIds).toHaveLength(1);
  const branchId = branchIds[0];
  const branchRecord = evidence.branches.find(
    (branch) =>
      (branch.id === branchId || branch.data?.id === branchId) &&
      (branch.clinic_id === clinicId ||
        branch.clinicId === clinicId ||
        branch.data?.clinicId === clinicId) &&
      JSON.stringify(branch).includes(branchName),
  );
  expect(branchRecord, "the doctor's sole persisted branch belongs to this clinic/location").toBeTruthy();

  const query = new URLSearchParams({ clinicId, branchId, status: "active" });
  const directoryResponse = await page.request.get(`/api/doctors?${query.toString()}`);
  expect(directoryResponse.status()).toBe(200);
  const result = await directoryResponse.json();
  expect(result.total).toBe(1);
  expect(Array.isArray(result.items)).toBe(true);
  const directory: any[] = result.items;
  console.log("Scoped real GET /api/doctors", {
    clinicId,
    branchId,
    status: "active",
    returned: directory.map((doctor) => ({ id: doctor.id, fullName: doctor.fullName, branchIds: doctor.branchIds })),
  });
  expect(directory).toHaveLength(1);
  expect(directory[0].id).toBe(doctorId);
  expect(directory[0].fullName).toBe(ownerName);
  expect(directory[0].branchIds).toEqual([branchId]);

  await expect(page.getByTestId("text-location-fixed")).toContainText(branchName);
  await expect(page.getByTestId("text-location-fixed")).toContainText(clinicName);
  await expect(page.getByTestId("fixed-scope-doctors").getByRole("textbox")).toHaveValue(ownerName);
  if (previousOwnerName) await expect(page.getByText(previousOwnerName, { exact: true })).toHaveCount(0);
  return { clinicId, branchId, doctorId, evidence };
}

function nextMondayFromDisplayedDate(value: string): string {
  const date = new Date(`${value} UTC`);
  if (Number.isNaN(date.getTime())) throw new Error(`Cannot parse displayed booking date: ${value}`);
  const daysUntilMonday = ((1 - date.getUTCDay() + 7) % 7) || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function createBooking(
  page: Page,
  testInfo: TestInfo,
  options: {
    clinicName: string;
    branchName: string;
    ownerName: string;
    patientName: string;
    previousOwnerName?: string;
  },
) {
  const bookingLink = page.getByTestId("link-page-book-appointment");
  await expect(bookingLink, "Open Workspace must finish without a hard-navigation workaround").toBeVisible();
  await bookingLink.click();
  await expect(page).toHaveURL(/\/admin\/book$/);
  await verifyRealOwnerDirectory(
    page,
    options.clinicName,
    options.branchName,
    options.ownerName,
    options.previousOwnerName,
  );

  // Default Wednesday is intentionally checked as a no-session day. A Monday
  // configured by the same real wizard then demonstrates the distinction
  // between missing sessions and a missing doctor.
  const date = page.getByTestId("input-booking-date");
  const defaultDate = await date.inputValue();
  const parsedDefault = new Date(`${defaultDate} UTC`);
  if (parsedDefault.getUTCDay() === 1) {
    parsedDefault.setUTCDate(parsedDefault.getUTCDate() + 1);
    await date.fill(new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
    }).format(parsedDefault));
  }
  await expect(page.getByTestId("status-no-doctor-sessions")).toBeVisible();
  const monday = nextMondayFromDisplayedDate(await date.inputValue());
  await date.fill(monday);
  await expect(page.getByText(/places remaining/)).toBeVisible();
  await expect(page.getByTestId("button-booking-continue-visit")).toBeEnabled();
  await page.getByTestId("button-booking-continue-visit").click();

  await page.getByRole("button", { name: "Register a New Patient" }).click();
  await page.getByTestId("input-fullName").fill(options.patientName);
  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Active", exact: true }).click();
  await page.getByTestId("button-save").click();
  await expect(page.getByText("Patient registered and selected.", { exact: true })).toBeVisible();
  await page.getByTestId("button-booking-continue-patient").click();
  await expect(page.getByTestId("booking-summary")).toContainText(options.ownerName);
  await expect(page.getByTestId("booking-summary")).toContainText(options.patientName);
  await page.getByRole("checkbox", {
    name: "I consent to appointment management and the clinic's booking policy.",
  }).check();
  await page.getByTestId("button-confirm-booking").click();
  const ticket = page.getByTestId("appointment-ticket");
  await expect(ticket).toContainText("Booked");
  await expect(ticket).toContainText(options.ownerName);
  await expect(ticket).toContainText(options.patientName);
  await expect(ticket).toContainText(options.clinicName);
  await expect(ticket).toContainText(options.branchName);
  await page.screenshot({
    path: testInfo.outputPath(`${options.ownerName.toLowerCase().replaceAll(" ", "-")}-ticket.png`),
    fullPage: true,
  });

  const ticketText = await ticket.innerText();
  const reference = ticketText.match(/\bCF-[A-Z0-9]{8,}\b/)?.[0];
  expect(reference, "ticket reference").toBeTruthy();
  const evidence = await readEvidence(page);
  const appointment = evidence.appointments.find((record) =>
    JSON.stringify(record).includes(reference!),
  );
  expect(appointment, "persisted appointment matching ticket reference").toBeTruthy();
  for (const expected of [options.ownerName, options.patientName, options.clinicName, options.branchName]) {
    expect(JSON.stringify(appointment)).toContain(expected);
  }
  const patient = evidence.patients.find((record) =>
    JSON.stringify(record).includes(options.patientName),
  );
  expect(patient, "persisted patient created through booking UI").toBeTruthy();
  return { reference: reference!, appointment, patient };
}

async function addStandalonePatient(page: Page, name: string) {
  await page.getByTestId("nav-patients").click();
  await page.getByTestId("button-add-patients").click();
  await page.getByTestId("input-fullName").fill(name);
  await page.getByRole("button", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Active", exact: true }).click();
  await page.getByTestId("button-save").click();
  await expect(page.getByText(/No appointment is required/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  const evidence = await readEvidence(page);
  expect(evidence.patients.some((patient) => JSON.stringify(patient).includes(name))).toBe(true);
}

test("real self-owner and invited Super Admin owner registration, scoped booking, patients, and tickets", async ({ page }, testInfo) => {
  test.skip(!BASE_URL, "Opt-in only: set OWNER_BOOKING_BASE_URL to the real Preview of the isolated disposable harness.");
  const self = {
    owner: "Browser Self Owner",
    email: "browser-self@owner.test.invalid",
    clinic: "Fictional Browser Self",
    branch: "Fictional Self Main",
    patient: "Self Owner Booking Patient",
  };
  const admin = {
    owner: "Browser Admin Owner",
    email: "browser-admin@owner.test.invalid",
    clinic: "Fictional Browser Admin",
    branch: "Fictional Admin Main",
    patient: "Admin Owner Booking Patient",
  };

  // Self-registration is verified with the fake-mail code, then completed in
  // the same tab through the actual six-step wizard.
  await page.goto("/register-clinic");
  await page.getByRole("textbox", { name: "Your Name" }).fill(self.owner);
  await page.getByTestId("input-registration-email").fill(self.email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Review account details" }).click();
  await page.getByRole("button", { name: "Send verification code" }).click();
  const selfMail = (await readEvidence(page)).mail.find(
    (mail) => mail.to === self.email && mail.subject.includes("registration"),
  );
  expect(selfMail).toBeTruthy();
  const code = selfMail!.text.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();
  await page.getByRole("textbox", { name: "Required email verification code" }).fill(code!);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await fillOwnerWizard(page, {
    clinicName: self.clinic,
    ownerName: self.owner,
    ownerEmail: self.email,
    clinicEmail: "front@owner.test.invalid",
    superAdmin: false,
    password: PASSWORD,
  });
  await page.getByTestId("registration-open-workspace").click();
  await createBooking(page, testInfo, {
    clinicName: self.clinic,
    branchName: self.branch,
    ownerName: self.owner,
    patientName: self.patient,
  });
  await addStandalonePatient(page, "Standalone Registration Patient");

  // Self-owner must remain the selected doctor after a true signout/login.
  await signOutToStaffLogin(page);
  await signIn(page, self.email, PASSWORD, self.owner);
  await page.getByTestId("link-page-book-appointment").click();
  await page.reload();
  await verifyRealOwnerDirectory(page, self.clinic, self.branch, self.owner);
  await expect(page.getByTestId("fixed-scope-doctors").getByRole("textbox")).toHaveValue(self.owner);

  // The fixture Super Admin creates the second consulting owner through the
  // same UI; the invite is accepted only through its actual /set-password URL.
  await signOutToStaffLogin(page);
  await signIn(page, SUPER_EMAIL, SUPER_PASSWORD, "Fictional Super Admin");
  await page.goto("/register-clinic");
  await fillOwnerWizard(page, {
    clinicName: admin.clinic,
    ownerName: admin.owner,
    ownerEmail: admin.email,
    clinicEmail: "front-admin@owner.test.invalid",
    superAdmin: true,
  });
  const invitation = (await readEvidence(page)).mail.find(
    (mail) => mail.to === admin.email && mail.subject.toLowerCase().includes("password setup"),
  );
  expect(invitation).toBeTruthy();
  const inviteURL = invitation!.text
    .match(/https:\/\/fictional\.test\.invalid\/set-password\?[^\s<>"']+/)?.[0]
    ?.replace(/[),;]+$/, "");
  expect(inviteURL).toBeTruthy();
  const previewOrigin = new URL(BASE_URL!).origin;
  await page.goto(inviteURL!.replace("https://fictional.test.invalid", previewOrigin));
  await page.getByTestId("input-invitation-password").fill(PASSWORD);
  await page.getByTestId("button-set-invitation-password").click();
  await expect(page.getByText("Your password is saved.", { exact: false })).toBeVisible();
  await page.getByTestId("link-invitation-staff-login").click();
  await signIn(page, admin.email, PASSWORD, admin.owner);
  await createBooking(page, testInfo, {
    clinicName: admin.clinic,
    branchName: admin.branch,
    ownerName: admin.owner,
    patientName: admin.patient,
    previousOwnerName: self.owner,
  });

  // A new session and a hard page reload must not restore the first owner's
  // doctor label or directory options.
  await signOutToStaffLogin(page);
  await signIn(page, admin.email, PASSWORD, admin.owner);
  await page.getByTestId("link-page-book-appointment").click();
  await page.reload();
  await verifyRealOwnerDirectory(page, admin.clinic, admin.branch, admin.owner, self.owner);
  await expect(page.getByTestId("fixed-scope-doctors").getByRole("textbox")).toHaveValue(admin.owner);
});
