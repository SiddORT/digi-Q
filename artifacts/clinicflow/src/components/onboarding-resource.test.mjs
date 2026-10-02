import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as dateTime from "../lib/date-time.ts";
import { validateDateOfBirth, ageFromDateOfBirth, validatePersonName, validatePhone } from "../lib/validators.ts";

const source=name=>readFileSync(new URL(name,import.meta.url),"utf8");
const hours={};
new Function("exports","require",ts.transpileModule(source("./ClinicRegistrationHours.tsx"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(hours,name=>name.includes("date-time")?dateTime:{});

test("weekly sessions preserve exact minutes, allow adjacent sessions, reject overlap and invalid clocks",()=>{
  const day={dayOfWeek:1,isOpen:true,sessions:[{startTime:"09:00",endTime:"13:00"},{startTime:"13:00",endTime:"20:32"}]};
  assert.equal(hours.dayError(day),"");
  assert.match(hours.dayError({...day,sessions:[...day.sessions,{startTime:"12:59",endTime:"14:00"}]}),/non-overlapping/);
  for(const [startTime,endTime] of [["20:32","20:32"],["23:00","01:00"],["09:00","25:00"],["","14:00"]])assert.ok(hours.dayError({...day,sessions:[{startTime,endTime}]}));
  assert.equal(hours.dayError({...day,isOpen:false,sessions:[]}),"");
  assert.match(hours.validateWeek(hours.newWeek()),/at least one open day/);
});
test("shared person, phone and birth-date validation distinguishes optional and invalid values",()=>{
  assert.equal(validatePersonName("  Anne-Marie O’Neil  "),undefined);
  assert.ok(validatePersonName("123"));
  assert.ok(validatePhone("+"));
  assert.equal(validatePhone("+91 98765 43210"),undefined);
  assert.ok(validateDateOfBirth("2031-03-01",new Date(2030,2,1)));
  assert.equal(ageFromDateOfBirth("2000-03-02",new Date(2030,2,1)),29);
  assert.equal(ageFromDateOfBirth("2000-03-02",new Date(2030,2,2)),30);
});
test("formats are submitted atomically and settings only patch display preferences",()=>{
  for(const file of ["./ClinicAdminOnboarding.tsx","./ClinicRegistration.tsx"]){
    const ui=source(file);
    assert.match(ui,/clinic: \{ dateFormat: values.dateFormat, timeFormat: values.timeFormat/);
    assert.match(ui,/ownerSchedule:/);
  }
  assert.match(source("./ClinicSettings.tsx"),/data:\{clinic:formats\}/);
  assert.match(source("./ClinicSettings.tsx"),/Stored dates, session times and bookings will not be rewritten/);
});
test("exception session requirement mirrors the existing multi-session override rule",()=>{
  const ui=source("../resources.tsx");
  assert.match(ui,/needsSession=!closed&&\(sessions.data\?\.total\|\|rows.length\)>1/);
  assert.match(ui,/Choose a session for this date exception/);
  assert.match(ui,/api.listSchedules\(\{doctorId,branchId,dayOfWeek/);
  assert.doesNotMatch(ui,/window\.confirm|[^.\w]confirm\(/);
  assert.match(ui,/friendlyError\(error\)/);
});
test("onboarding resets stale mutation errors when navigating and secondary choices use searchable controls",()=>{
  assert.match(source("./ClinicRegistration.tsx"),/onStepChange=\{registration.reset\}/);
  assert.match(source("./ClinicAdminOnboarding.tsx"),/onStepChange=\{setup.reset\}/);
  const wizard=source("./ClinicRegistrationWizard.tsx");
  assert.match(wizard,/useEffect\(\(\)=>\{onStepChange\?\.\(\);\},\[step,onStepChange\]\)/);
  assert.doesNotMatch(wizard,/<select\b/);
  assert.match(wizard,/SearchableMultiSelect label="Qualifications/);
});
test("registration resends by retained challenge only, with server-aligned cooldown and restart guidance",()=>{
  const ui=source("./ClinicRegistration.tsx");
  assert.match(ui,/"registration\/resend",\{challengeId\}/);
  assert.match(ui,/setCooldown\(60\)/);
  assert.match(ui,/busy\|\|cooldown>0\|\|!challengeId/);
  assert.match(ui,/original expiry time still applies/);
  assert.match(ui,/Change details to restart registration/);
});
test("doctor weekly editing keeps independent saves explicit and shades only comparable clinic times",()=>{
  const ui=source("./schedule/WeeklyOverview.tsx");
  assert.match(ui,/not an atomic weekly update/);
  assert.match(ui,/Copy to selected days/);
  assert.match(ui,/>Add session</);
  assert.match(source("../resources.tsx"),/clinicHours=\{matchingTimezone\?clinicHours:\[\]\}/);
  assert.match(source("../resources.tsx"),/existing server rules decide whether it can be saved/);
  assert.doesNotMatch(source("../resources.tsx"),/\.toLocaleString\(/);
});