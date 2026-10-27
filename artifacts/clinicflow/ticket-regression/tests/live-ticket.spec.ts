import { test, expect, type Page } from "@playwright/test";
const capability = "e".repeat(64);
const estimate = { state:"ready", basis:"sessionStart", asOf:"2030-06-14T08:00:00Z", patientsAhead:3, waitMinutes:90, suggestedArrival:"11:20", beyondSessionEnd:false, guidance:"Estimate only, not an appointment time. Breaks and delays can change the wait." };
const appointment = { id:"live-1", patientId:"patient-1", doctorId:"d", clinicId:"c", branchId:"b", date:"2030-06-14", startTime:"10:00", endTime:"16:00", timezone:"UTC", patientName:"Private Fictional Patient", reference:"PRIVATE-REFERENCE", patientCode:"P1", doctorName:"Dr Fictional", clinicName:"Fictional Clinic", branchName:"Booked Branch", branchAddress:"21 Fictional Branch Road", token:"A-42", status:"waiting", revision:1, allowedActions:["cancel"], canReschedule:true, history:[], createdAt:"2030-06-01T12:00:00Z", estimate };
type State = { role:string|null; owner:boolean; status:number; paused:boolean; address:string|null };
async function mount(page:Page, state:State) {
  await page.route("**/api/**", async route => {
    const req=route.request(), path=new URL(req.url()).pathname;
    expect(req.url()).not.toContain(capability);
    let body:any = {};
    if(path==="/api/auth/status") body={authenticated:!!state.role,role:state.role};
    else if(path==="/api/me") body={user:{id:state.owner?"owner":"other",role:state.role,patientId:state.owner?"patient-1":"patient-2"},needsOnboarding:false};
    else if(path==="/api/auth/csrf") body={csrfToken:"fictional-csrf"};
    else if(path==="/api/public/website-config") body={publicOrigin:"https://tickets.example.invalid"};
    else if(path==="/api/public/live-ticket") {
      expect(req.method()).toBe("POST");
      expect(req.postDataJSON()).toEqual({capability});
      if(state.status!==200) { await route.fulfill({status:state.status,json:{error:"Fixture unavailable"}}); return; }
      const {patientName,patientCode,reference,patientId,id,history,allowedActions,canReschedule,revision,createdAt,...minimal}=appointment;
      body={...minimal,branchAddress:state.address,updatedAt:estimate.asOf,presence:state.paused?"onBreak":"available",
        estimate:state.paused?{...estimate,state:"paused",waitMinutes:null,suggestedArrival:null,guidance:"Doctor is on break. Check again shortly."}:estimate,
        ...(state.owner?{appointment}: {})};
    } else if(path==="/api/appointments/live-1") body=appointment;
    else if(path==="/api/appointments/live-1/qr") body={appointmentId:"live-1",payload:"fictional",checkInUrl:"/check-in?payload=fictional"};
    else if(path==="/api/queue") body={presence:{status:"available"},ownEntry:{token:appointment.token,estimate},entries:[]};
    await route.fulfill({json:body});
  });
  await page.goto(`/live-ticket?mode=live#${capability}`);
}
test("public status scrubs the fragment, stays minimal and handles mobile directions/offline/errors",async({page,context})=>{
  const state:State={role:null,owner:false,status:200,paused:false,address:appointment.branchAddress};
  await page.setViewportSize({width:390,height:844});
  await mount(page,state);
  await expect(page.getByTestId("live-ticket-token")).toHaveText("A-42");
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("90 minutes");
  expect(new URL(page.url()).hash).toBe("");
  expect(await page.evaluate(()=>sessionStorage.getItem("clinicflow-live-ticket"))).toBe(capability);
  await expect(page.locator("body")).not.toContainText("Private Fictional Patient");
  await expect(page.locator("body")).not.toContainText("PRIVATE-REFERENCE");
  await expect(page.getByAltText("Personal visit QR")).toHaveCount(0);
  const popupEvent=page.waitForEvent("popup");
  await page.getByTestId("button-get-directions").focus();await page.keyboard.press("Enter");
  const popup=await popupEvent;await popup.waitForURL(/google\.com/);
  expect(new URL(popup.url()).searchParams.get("destination")).toBe(appointment.branchAddress);
  expect(popup.url()).not.toContain(capability);await popup.close();
  expect(await page.locator('meta[name="referrer"]').getAttribute("content")).toBe("no-referrer");
  const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await context.setOffline(true);await expect(page.getByTestId("live-ticket-stale")).toBeVisible();
  await expect(page.getByTestId("text-ticket-estimate")).not.toContainText("90 minutes");
  await context.setOffline(false);await expect(page.getByTestId("text-ticket-estimate")).toContainText("90 minutes");
  state.paused=true;state.address=null;await page.reload();
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("Doctor is on break");
  await expect(page.getByTestId("button-get-directions")).toBeDisabled();
  state.status=503;await page.reload();await expect(page.getByTestId("live-ticket-connection")).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem("clinicflow-live-ticket"))).toBe(capability);
  state.status=404;await page.getByRole("button",{name:"Retry",exact:true}).click();
  await expect(page.getByTestId("live-ticket-invalid")).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem("clinicflow-live-ticket"))).toBeNull();
});
test("server-provided owner ticket alone enables personal QR and existing permitted management",async({page})=>{
  const state:State={role:"patient",owner:true,status:200,paused:false,address:appointment.branchAddress};
  await mount(page,state);
  await expect(page.getByTestId("live-ticket-owner")).toBeVisible();
  await expect(page.getByAltText("Personal visit QR")).toBeVisible();
  await expect(page.getByTestId("button-download-ticket")).toBeVisible();
  await page.getByTestId("menu-live-1").click();
  await expect(page.getByRole("menuitem",{name:"Reschedule",exact:true})).toBeVisible();
  await expect(page.getByRole("menuitem",{name:"Cancel",exact:true})).toBeVisible();
  for(const role of ["patient","clinicAdmin"]){
    state.owner=false;state.role=role;await page.reload();
    await expect(page.getByTestId("live-ticket-token")).toBeVisible();
    await expect(page.getByTestId("live-ticket-owner")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Private Fictional Patient");
    await expect(page.getByAltText("Personal visit QR")).toHaveCount(0);
  }
});
