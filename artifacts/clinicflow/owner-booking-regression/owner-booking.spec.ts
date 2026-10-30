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

// Use the browser's same-origin transport, not Playwright's separate HTTP jar:
// Chromium accepts Secure cookies on loopback while APIRequestContext may not.
// Never copy session cookies/tokens into test output or fabricate identity.
async function browserRequest(page: Page, method: string, url: string, data?: unknown) {
  const result=await page.evaluate(async ({method,url,data})=>{
    const response=await fetch(url,{
      method,credentials:"same-origin",cache:"no-store",
      ...(data===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),
    });
    return {status:response.status,text:await response.text()};
  },{method,url,data});
  return {status:()=>result.status,text:async()=>result.text,json:async()=>JSON.parse(result.text)};
}

async function readEvidence(page: Page): Promise<Evidence> {
  const response = await browserRequest(page,"GET","/api/__owner-booking-evidence");
  expect(response.status(), "read-only owner evidence endpoint").toBe(200);
  return response.json();
}

async function latestMail(page: Page, email: string, subject: string) {
  let mail: Evidence["mail"][number] | undefined;
  await expect.poll(async()=>{
    mail=(await readEvidence(page)).mail.findLast(mail=>mail.to===email&&mail.subject.toLowerCase().includes(subject));
    return !!mail;
  },{message:"Wait for simulated asynchronous outbox",timeout:15000}).toBe(true);
  return mail!;
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
  await expect(page.getByTestId("registration-also-consult")).toBeChecked();
  await page.getByTestId("registration-link-hours").check();
  await page.getByTestId("registration-session-capacity").fill("20");
  await page.getByRole("button", { name: "Expected Consultation Duration" }).click();
  await page.getByRole("option", { name: "20 minutes", exact: true }).click();
  await page.getByTestId("registration-next").click();

  if (options.password && (await page.getByTestId("registration-confirm-password").count())) {
    await page.getByTestId("registration-confirm-password").fill(options.password);
  }
  await expect(page.getByText("Finish saves the clinic, locations and any chosen doctor sessions together.", {exact:false})).toBeVisible();
  const submitted = page.waitForRequest(request =>
    request.method() === "POST" &&
    new URL(request.url()).pathname === (options.superAdmin ? "/api/clinic-admin-onboarding" : "/api/clinic-registration"));
  await page.getByTestId("registration-next").click();
  expect((await submitted).postDataJSON().ownDoctor).toBe(true);
  await expect(page.getByRole("heading", { name: `${options.clinicName} is registered.` })).toBeVisible();
}

async function ownerFromMe(page: Page) {
  const response = await browserRequest(page,"GET","/api/me");
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
  const directoryResponse = await browserRequest(page,"GET",`/api/doctors?${query.toString()}`);
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

  await expect(page.getByTestId("text-booking-location-fixed")).toContainText(branchName);
  await expect(page.getByTestId("text-booking-location-fixed")).toContainText(clinicName);
  await expect(page.getByRole("button",{name:`Doctor: ${ownerName}`,exact:true})).toBeVisible();
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
    superAdmin?: boolean;
  },
) {
  const bookingLink = page.getByTestId("link-page-book-appointment");
  await expect(bookingLink, "Open Workspace must finish without a hard-navigation workaround").toBeVisible();
  await bookingLink.click();
  await expect(page).toHaveURL(/\/admin\/book$/);
  if (options.superAdmin) {
    await selectConsultingClinic(page, options.clinicName, options.branchName, options.ownerName);
  } else await verifyRealOwnerDirectory(
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
  await expect(page.getByTestId("booking-availability-status")).toContainText("No doctor session is listed");
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

async function selectConsultingClinic(page: Page, clinicName: string, branchName: string, doctorName?: string) {
  const clinic = page.getByRole("button", {name:/^Clinic group(?::|$)/i});
  // Cold route mounts must wait for authenticated controls, not mistake the
  // initial absent button for a sole/pinned clinic.
  await expect(clinic).toBeVisible();
  await clinic.click();
  await page.getByRole("option", {name:clinicName,exact:true}).click();
  // The saved consulting location is the only location of this fictional clinic.
  await expect(page.getByRole("button",{name:`Location: ${branchName}`,exact:true})).toBeVisible();
  if (doctorName) await expect(page.getByRole("button",{name:`Doctor: ${doctorName}`,exact:true})).toBeVisible();
  expect((await (await browserRequest(page,"GET","/api/me")).json()).user.role).toBe("superAdmin");
}

async function verifySuperFreshness(page: Page, clinicName: string, branchName: string, doctorName: string) {
  await page.goto("/admin/book");
  const afterPlural=!!process.env.OWNER_BOOKING_CONTINUE_AFTER_PLURAL;
  await selectConsultingClinic(page,clinicName,branchName,afterPlural?undefined:doctorName);
  const evidence=await readEvidence(page);
  const user=evidence.users.find(user=>user.full_name===doctorName);
  const doctor=evidence.doctors.find(doctor=>doctor.user_id===user.id);
  const branchId=doctor.data.branchIds[0];
  const branch=evidence.branches.find(branch=>branch.id===branchId);
  const params=new URLSearchParams({clinicId:branch.clinic_id,branchId,status:"active",page:"1",pageSize:"20"});
  const directory=await browserRequest(page,"GET",`/api/doctors?${params}`);
  expect(directory.status()).toBe(200);
  const initial=(await directory.json()).items.map((item:any)=>item.id);
  expect(initial).toContain(doctor.id);
  if(!afterPlural) expect(initial).toEqual([doctor.id]);
  if(!afterPlural) for (const status of ["inactive","active"]) {
    const start=Date.now();
    expect((await browserRequest(page,"POST","/api/__owner-booking-doctor-status", {doctorId:doctor.id,status})).status()).toBe(200);
    if(status==="inactive") {
      await expect(page.getByRole("button",{name:"Doctor",exact:true})).toBeVisible({timeout:80_000});
      await expect(page.getByText("No active assigned doctors are available", {exact:false})).toBeVisible();
    } else {
      await expect(page.getByRole("button",{name:`Doctor: ${doctorName}`,exact:true})).toBeVisible({timeout:80_000});
    }
    console.log(`Persisted doctor ${status} rendered after ${Date.now()-start}ms (60s refresh + transport)`);
  }
  await page.reload();
  await selectConsultingClinic(page,clinicName,branchName,afterPlural?undefined:doctorName);

  // A second, distinct fictional clinician makes cardinality genuinely plural.
  // Use the real write handler with simulated invitations, not a UI mock.
  const existingUser=afterPlural?evidence.users.find(user=>user.email==="colleague@owner.test.invalid"):undefined;
  const existing=existingUser?evidence.doctors.find(profile=>profile.user_id===existingUser.id):undefined;
  let second=existing;
  if(!second) {
  const colleague=await browserRequest(page,"POST","/api/doctors",{
    fullName:"Fictional Colleague",email:"colleague@owner.test.invalid",
    clinicIds:[branch.clinic_id],branchIds:[branchId],status:"active",
  });
  expect(colleague.status(),await colleague.text()).toBe(201);
  second=await colleague.json();
  }
  await page.reload();
  await selectConsultingClinic(page,clinicName,branchName);
  const doctorSelect=page.getByRole("button",{name:"Doctor",exact:true});
  await expect(doctorSelect).toBeVisible();
  await doctorSelect.click();
  await expect(page.getByRole("option",{name:doctorName,exact:true})).toBeVisible();
  await expect(page.getByRole("option",{name:"Fictional Colleague",exact:true})).toBeVisible();
  await page.getByRole("option",{name:doctorName,exact:true}).click();
  if(!afterPlural || !evidence.users.some(user=>user.email==="receptionist@owner.test.invalid")) {
  const receptionist=await browserRequest(page,"POST","/api/users",{
    fullName:"Fictional Receptionist",email:"receptionist@owner.test.invalid",role:"receptionist",
    clinicIds:[branch.clinic_id],branchIds:[branchId],status:"active",
  });
  expect(receptionist.status(),await receptionist.text()).toBe(201);
  }
  await page.goto(`/admin/clinics/${branch.clinic_id}/staff?tab=doctors`);
  await expect(page.getByTestId(`row-staff-${doctor.id}`)).toContainText(doctorName);
  await expect(page.getByTestId(`row-staff-${second.id}`)).toContainText("Fictional Colleague");
  expect((await browserRequest(page,"POST","/api/__owner-booking-doctor-status",{doctorId:second.id,status:"inactive"})).status()).toBe(200);
  await page.goto("/admin/book");
  await selectConsultingClinic(page,clinicName,branchName,doctorName);
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
  // Refuse all account/booking writes unless this is the disposable fixture.
  await page.goto("/sign-in");
  await readEvidence(page);
  const run=Date.now().toString(36);
  const self = {
    owner: "Browser Self Owner",
    email: process.env.OWNER_BOOKING_EXISTING_SELF_EMAIL || `browser-self-${run}@owner.test.invalid`,
    clinic: "Fictional Browser Self",
    branch: "Fictional Self Main",
    patient: "Self Owner Booking Patient",
  };
  const admin = {
    owner: "Browser Admin Owner",
    email: `browser-admin-${run}@owner.test.invalid`,
    clinic: "Fictional Browser Admin",
    branch: "Fictional Admin Main",
    patient: "Admin Owner Booking Patient",
  };

  if (!process.env.OWNER_BOOKING_CONTINUE_AFTER_SUPER) {
  // Self-registration is verified with the fake-mail code, then completed in
  // the same tab through the actual five-section wizard.
  if(process.env.OWNER_BOOKING_EXISTING_SELF_EMAIL) {
    await signIn(page,self.email,PASSWORD,self.owner);
  } else {
  await page.goto("/register-clinic");
  await page.getByRole("textbox", { name: "Your Name" }).fill(self.owner);
  await page.getByTestId("input-registration-email").fill(self.email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send verification code" }).click();
  const selfMail = await latestMail(page,self.email,"registration");
  expect(selfMail).toBeTruthy();
  const code = selfMail!.text.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();
  await page.getByRole("textbox", { name: "Required email verification code" }).fill(code!);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByTestId("registration-name"),"verified owner must reach clinic setup").toBeVisible();
  await fillOwnerWizard(page, {
    clinicName: self.clinic,
    ownerName: self.owner,
    ownerEmail: self.email,
    clinicEmail: "front@owner.test.invalid",
    superAdmin: false,
    password: PASSWORD,
  });
  await page.getByTestId("registration-open-workspace").click();
  }
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
  await expect(page.getByRole("button",{name:`Doctor: ${self.owner}`,exact:true})).toBeVisible();

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
  await page.goto("/admin/dashboard");
  await createBooking(page,testInfo,{
    clinicName:self.clinic,branchName:self.branch,ownerName:self.owner,
    patientName:"Super Admin Booking Patient",superAdmin:true,
  });
  } else {
    // Narrow continuation after a failed freshness assertion: do not repeat
    // the already-passed registration or create duplicate clinic fixtures.
    const evidence=await readEvidence(page);
    self.email=evidence.users.find(user=>user.full_name===self.owner)?.email;
    admin.email=evidence.users.find(user=>user.full_name===admin.owner)?.email;
    expect(self.email).toBeTruthy();
    expect(admin.email).toBeTruthy();
    await signIn(page,SUPER_EMAIL,SUPER_PASSWORD,"Fictional Super Admin");
  }
  if (!process.env.OWNER_BOOKING_CONTINUE_AFTER_STAFF) {
    await verifySuperFreshness(page,self.clinic,self.branch,self.owner);
  } else {
    const evidence=await readEvidence(page);
    const colleagueUser=evidence.users.find(user=>user.email==="colleague@owner.test.invalid");
    const colleague=evidence.doctors.find(doctor=>doctor.user_id===colleagueUser?.id);
    expect(colleague).toBeTruthy();
    expect((await browserRequest(page,"POST","/api/__owner-booking-doctor-status",{doctorId:colleague.id,status:"inactive"})).status()).toBe(200);
  }
  await signOutToStaffLogin(page);
  await signIn(page,self.email,PASSWORD,self.owner);
  const selfIdentity=await ownerFromMe(page);
  await page.goto(`/admin/clinics/${selfIdentity.clinicId}/staff?tab=doctors`);
  await expect(page.getByTestId(`row-staff-${selfIdentity.doctorId}`)).toContainText(self.owner);
  const savedStaff=await readEvidence(page);
  const colleagueUser=savedStaff.users.find(user=>user.email==="colleague@owner.test.invalid");
  const colleague=savedStaff.doctors.find(doctor=>doctor.user_id===colleagueUser?.id);
  await expect(page.getByTestId(`row-staff-${colleague.id}`)).toContainText("Fictional Colleague");
  await page.goto("/admin/book");
  await verifyRealOwnerDirectory(page,self.clinic,self.branch,self.owner);
  await signOutToStaffLogin(page);
  await signIn(page,SUPER_EMAIL,SUPER_PASSWORD,"Fictional Super Admin");
  await page.goto("/admin/book");
  await selectConsultingClinic(page,self.clinic,self.branch,self.owner);
  const invitation = await latestMail(page,admin.email,"password setup");
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
  await expect(page.getByRole("button",{name:`Doctor: ${admin.owner}`,exact:true})).toBeVisible();
});
