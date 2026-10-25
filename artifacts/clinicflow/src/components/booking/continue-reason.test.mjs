import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const {code}=await transform(readFileSync(new URL("./continue-reason.ts",import.meta.url),"utf8"),{loader:"ts",format:"esm"});
const {bookingContinueReason}=await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const ready={clinicId:"c",branchId:"b",doctorId:"d",date:"2026-11-01",dateValid:true,today:"2026-11-01",lastDate:"2026-12-01",detailsError:false,detailsLoading:false,membership:"valid",contextError:false,contextLoading:false,availabilityError:false,availabilityLoading:false,sessionCount:2,hasSession:true,sessionAvailable:true,remaining:3,stale:false,ready:true,sourceError:null};
for(const [changes,expected] of [
  [{clinicId:""},/clinic group/],[{branchId:""},/location/],[{doctorId:""},/doctor/],
  [{dateValid:false},/valid visit date/],[{detailsError:true},/Retry the selected/],
  [{detailsLoading:true},/Loading selected/],[{membership:"checking"},/assignment/],
  [{membership:"invalid"},/assigned/],[{contextError:true},/Retry availability/],
  [{availabilityError:true},/Retry availability/],[{contextLoading:true},/Checking current/],
  [{availabilityLoading:true},/Checking current/],[{stale:true},/Refresh/],
  [{sessionCount:0,hasSession:false},/No sessions on this date/],
  [{hasSession:false},/Select a consulting session/],[{remaining:0},/unavailable/],
  [{sourceError:"Advance bookings are not allowed for this session."},/^Advance bookings/],
  [{date:"2026-10-31"},/today or a later/],[{date:"2026-12-02"},/booking window/],
])test(`Continue explanation: ${JSON.stringify(changes)}`,()=>assert.match(bookingContinueReason({...ready,...changes}),expected));
