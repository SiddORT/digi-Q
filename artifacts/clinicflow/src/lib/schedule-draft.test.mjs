import assert from "node:assert/strict";
import test from "node:test";
import { setupDraftSchema } from "./registration-draft.ts";

test("onboarding's draft allowlist retains every session setting and invalid-time intent, never passwords or saved identities",()=>{
  const settings={timezone:"Asia/Kolkata",tokenPrefix:"OWN",maxTokens:13,consultationMinutes:30,bufferMinutes:5,queueMode:"appointmentsOnly",breakStart:"10:00",breakEnd:"10:20",queueOpenTime:"08:30",queueCloseTime:"11:30"};
  const weeks=Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,isOpen:dayOfWeek===1,sessions:dayOfWeek===1?[{key:"draft",id:"must-not-persist",locked:true,startTime:"09:00",endTime:"12:00",settings:{...settings,password:"must-not-persist"},invalidTimes:["queueCloseTime"]}]:[]}));
  const parsed=setupDraftSchema.shape.values.shape.ownerWeeks.parse([weeks]);
  assert.deepEqual(parsed[0][1].sessions[0],{key:"draft",startTime:"09:00",endTime:"12:00",settings,invalidTimes:["queueCloseTime"]});
});
