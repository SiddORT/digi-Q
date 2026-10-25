import type { Page } from "@playwright/test";

// Fail closed: no request may reach the live backend, including unknown reads.
export async function appWideFixture(page: Page, role: string) {
  const clinic = {id:"c1",adminId:`fictional-${role}`,name:"Fictional Long Named Community Clinic",slug:"fictional-clinic",status:"active",timezone:"UTC",dateFormat:"YYYY-MM-DD",timeFormat:"24h"};
  const branch = {id:"b1",clinicId:"c1",clinicName:clinic.name,name:"Fictional Central Consulting Location",slug:"central",timezone:"UTC",status:"active",city:"Example City",address:"10 Fictional Road",weeklyHours:[]};
  const user = {id:`fictional-${role}`,role,fullName:`Fictional ${role}`,email:"fictional@example.invalid",mobile:"+919876543210",status:"active",clinicIds:["c1"],branchIds:["b1"]};
  const doctor = {id:"d1",userId:role==="doctor"?user.id:"fictional-doctor",clinicId:"c1",branchId:"b1",clinicIds:["c1"],branchIds:["b1"],fullName:"Dr. Fictional Long Named Specialist",status:"active"};
  const patient = {id:"p1",userId:role==="patient"?user.id:"fictional-patient",fullName:"Fictional Long Named Patient",clinicId:"c1",branchId:"b1",status:"active",mobile:"+919876543210"};
  const visit = {id:"a1",reference:"FICTIONAL-VISIT-ONLY",token:"A-01",patientId:"p1",patientName:patient.fullName,doctorId:"d1",doctorName:doctor.fullName,clinicId:"c1",clinicName:clinic.name,branchId:"b1",branchName:branch.name,date:"2026-10-25",startTime:"09:00",endTime:"12:00",timezone:"UTC",status:"booked",revision:1,allowedActions:["cancel"],history:[],createdAt:"2026-10-24T12:00:00Z",dateFormat:"YYYY-MM-DD",timeFormat:"24h"};
  const list = (items:unknown[]) => ({items,total:items.length,page:1,pageSize:25});
  const metrics={appointments:1,completed:0,cancelled:0,noShow:0,uniquePatients:1,registrations:1,waiting:0,checkedIn:0,averageWaitMinutes:null,averageConsultationMinutes:null,consultationMinutes:null,timedConsultations:0,reschedules:0,rescheduledAppointments:0,activity:1};
  const notification={channel:"email",event:"booking",recipient:"patient",revision:1,enabled:false,source:"default",ready:false,required:false,blockedReasons:["Fictional delivery is disabled"],timing:"When a visit is booked",canActivate:role==="superAdmin",canEdit:true};
  const rows:Record<string,unknown[]> = {clinics:[clinic],branches:[branch],doctors:[doctor],patients:[patient],users:[{...user,role:"doctor",id:"fictional-doctor",fullName:doctor.fullName}],masters:[{id:"m1",category:"specialization",name:"General Medicine",status:"active"}],"audit-logs":[{id:"audit1",actorName:"Fictional Administrator",actorRole:"superAdmin",action:"update",entityType:"clinic",summary:"Updated fictional clinic",createdAt:"2026-10-24T12:00:00Z"}],qrs:[],schedules:[],"availability-exceptions":[]};
  const missing:string[] = [], writes:string[] = [], seen:string[] = [];
  await page.route("**/api/**",async route=>{
    const request=route.request(),url=new URL(request.url()),p=url.pathname.replace(/^\/api/,"");
    seen.push(p);
    if(request.method()!=="GET"){writes.push(`${request.method()} ${p}`);return route.fulfill({status:405,json:{error:"Writes are not allowed in layout acceptance"}});}
    let json:unknown;
    if(p==="/auth/status")json={authenticated:role!=="anonymous",role,staffPasswordVerified:true};
    else if(p==="/me"){
      if(role==="anonymous")return route.fulfill({status:401,json:{error:"Sign in to continue"}});
      json={user,needsOnboarding:false,doctorId:role==="doctor"?"d1":null,patientId:role==="patient"?"p1":null,clinicIds:["c1"],branchIds:["b1"],assignments:[{clinicId:"c1",branchId:"b1",doctorId:"d1"}],permissions:{}};
    }
    else if(p==="/settings")json={timezone:"UTC",dateFormat:"YYYY-MM-DD",timeFormat:"24h",sessionTimeoutMinutes:60};
    else if(p==="/public/website-config")json={publicOrigin:"https://clinic.example.invalid"};
    else if(p==="/staff-verification")json={email:user.email,mobile:user.mobile,emailVerified:true,mobileVerified:true,promptRequired:false};
    else if(p==="/workspaces")json={workspaces:[clinic],switchable:false,activeClinicId:null};
    else if(p==="/clinics/c1/settings")json={clinic,branches:[branch],policies:{bookingHorizonDays:30,cancellationCutoffMinutes:0}};
    else if(p==="/clinics/c1")json=clinic;
    else if(p==="/branches/b1")json=branch;
    else if(p==="/doctors/d1")json={...doctor,...(role==="doctor"?{fullName:user.fullName}:{})};
    else if(p==="/patients/p1")json={...patient,...(role==="patient"?{fullName:user.fullName}:{})};
    else if(p==="/staff-assignment-options")json={clinics:[clinic],branches:[branch],doctors:[doctor],pagination:{clinics:{total:1},branches:{total:1},doctors:{total:1}}};
    else if(p==="/appointments")json=list([visit]);
    else if(p==="/appointments/a1")json=visit;
    else if(p==="/dashboard")json={todayAppointments:1,waiting:0,completed:0,averageWait:0,recentAppointments:[visit],recentActivity:[]};
    else if(p==="/queue")json={entries:[],entriesTotal:0,total:0,waiting:0,inConsultation:0,completed:0,updatedAt:new Date().toISOString(),presence:{status:"available"}};
    else if(p==="/session-contexts")json=[];
    else if(p==="/public/availability/context")json={timezone:"UTC",today:"2026-10-25",lastBookableDate:"2026-11-25"};
    else if(p==="/public/availability/sessions")json=[];
    else if(p==="/booking/schedule-access")json={allowed:role!=="patient"};
    else if(p==="/public/qr/fictional-qr")json={reference:"fictional-qr",clinicId:"c1",clinicName:clinic.name,branchId:"b1",branchName:branch.name,branchTimezone:"UTC"};
    else if(p==="/public/clinics-by-slug/fictional-clinic"||p==="/public/clinics-by-slug/fictional-clinic/central")json={clinic,branch:p.endsWith("central")?branch:null,branches:[branch],doctors:[doctor],branchCount:1,branchDoctorCount:1,directoryPagination:{total:1,page:1,pageSize:25,totalPages:1}};
    else if(p==="/public/clinics")json=list([clinic]);
    else if(p==="/public/branches")json=list([branch]);
    else if(p==="/public/doctors")json=list([doctor]);
    else if(p==="/notifications")json={items:[],unreadCount:0,total:0};
    else if(p==="/saved-views")json={items:[]};
    else if(p==="/management/permissions")json={revision:1,roles:["clinicAdmin","doctor","receptionist"],modules:["appointments","patients"],actions:["read","create","update","delete"],denied:[]};
    else if(p==="/management/custom-roles")json={revision:1,roles:[],bindings:[]};
    else if(p==="/management/system-users")json={data:[{...user,clinics:[clinic]}],total:1,page:1,pageSize:25};
    else if(p==="/public/display/fictional-qr")json={clinic,branch,date:"2026-10-25",updatedAt:new Date().toISOString(),sessions:[]};
    else if(p==="/reports/analytics")json={from:url.searchParams.get("from")||"2026-10-01",to:url.searchParams.get("to")||"2026-10-25",timezone:"UTC",generatedAt:new Date().toISOString(),summary:metrics,previous:null,previousFrom:"2026-09-01",previousTo:"2026-09-25",points:[],previousPoints:[],rows:[{id:"r1",date:"2026-10-25",label:"Fictional Clinic Performance",group:"clinic",clinicId:"c1",clinic:clinic.name,type:"Visit",family:"appointments",status:"available",metrics}],total:1,page:1,pageSize:25,notes:[]};
    else if(p==="/reports")json={rows:[{key:"r1",label:clinic.name,appointments:1,completed:0,cancelled:0,noShow:0,registrations:1,averageWaitMinutes:0,averageConsultationMinutes:null}],from:"2026-10-01",to:"2026-10-25",groupBy:"date",total:1,page:1,pageSize:25,totalPages:1};
    else if(p==="/reports/trends")json={points:[],timezone:"UTC",from:"2026-10-01",to:"2026-10-25"};
    else if(p==="/reports/communication-usage")json={items:[],nextCursor:null,timezone:"Asia/Kolkata",total:0,counts:[],earliestAvailableAt:null,legacyCount:0,unattributedCount:0,scopeClinicId:role==="clinicAdmin"?"c1":null,scopeClinicName:role==="clinicAdmin"?clinic.name:null,userOptions:[],breakdowns:[]};
    else if(p==="/settings/integrations")json={editable:role==="superAdmin",smtp:{ready:false,source:"environment",revision:null,keys:[{key:"SMTP_HOST",status:"missing"}]},sms:{ready:false,source:"environment",revision:null,keys:[]},notificationSms:{ready:false,source:"environment",revision:null,keys:[]}};
    else if(p==="/settings/integrations/storage")json={provider:"object",source:"environment",publicPath:"/media",configured:false};
    else if(p==="/settings/integrations/smtp/test-receipt")json={receipt:null};
    else if(p==="/demo/setup")json={configured:false,enabled:false};
    else if(p==="/management/notification-settings")json={revision:1,scopeName:clinic.name,notificationsEnabled:false,inherited:false,canActivate:role==="superAdmin",events:[{id:"booking",label:"Booking confirmation",order:1,clinicApplicable:true,explanation:"Fictional booking delivery remains disabled."}],items:[notification]};
    else if(p==="/me/notification-settings")json={revision:1,clinics:[clinic],activeClinicId:"c1",notificationsEnabled:false,items:[]};
    else if(p==="/management/templates")json={scopeName:clinic.name,variables:["clinic_name","patient_name"],items:[{event:"booking",recipient:"patient",title:"Booking",revision:1,source:"default",content:{enabled:false,subject:"Fictional visit",body:"Hello {{patient_name}}",prefix:"",footer:"Contact {{clinic_name}}",logoUrl:""},previewSubject:"Fictional visit",previewBody:"Hello Fictional Patient",delivery:"Disabled"}]};
    else if(p==="/management/notification-logs")json={items:[],nextCursor:null};
    else if(p==="/schedules/day-context")json={items:[],days:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,following:false,custom:false,snapshot:`fictional-${dayOfWeek}`}))};
    else if(p==="/geography")json=list([]);
    else if(p.startsWith("/geography/"))json=list([]);
    else if(rows[p.slice(1)])json=list(rows[p.slice(1)]);
    else {missing.push(p);return route.fulfill({status:501,json:{error:`Missing fictional contract for ${p}`}});}
    await route.fulfill({json});
  });
  return {user,missing,writes,seen};
}
