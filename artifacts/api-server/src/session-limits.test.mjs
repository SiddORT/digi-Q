import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {rm} from "node:fs/promises";
import {resolve} from "node:path";
const file=resolve(import.meta.dirname,`.session-limits-${process.pid}.mjs`);
await build({entryPoints:[resolve(import.meta.dirname,"../../../lib/api-zod/src/generated/api.ts")],outfile:file,bundle:true,platform:"node",format:"esm",packages:"external"});
const {CreateScheduleBody: schema,CreateAvailabilityExceptionBody: exception}=await import(file);
const value={doctorId:"doctor",clinicId:"clinic",branchId:"branch",dayOfWeek:0,isOpen:true,startTime:"09:00",endTime:"14:00",tokenPrefix:"A",maxTokens:1000,consultationMinutes:10,bufferMinutes:1440};
test("schedule boundary limits permit maximums and reject overflow",()=>{
 assert.ok(schema.safeParse(value).success);
 for(const patch of [{maxTokens:1001},{maxTokens:123456789012345},{bufferMinutes:1441},{bufferMinutes:-1},{bufferMinutes:1.5}])assert.equal(schema.safeParse({...value,...patch}).success,false);
});
test("date exception capacity uses the same bound and allows regular capacity",()=>{
 const base={doctorId:"doctor",branchId:"branch",date:"2030-01-01",isClosed:false,reason:"Test"};
 assert.ok(exception.safeParse({...base,maxTokens:1000}).success);
 assert.ok(exception.safeParse({...base,maxTokens:null}).success);
 assert.equal(exception.safeParse({...base,maxTokens:1001}).success,false);
});
await rm(file,{force:true});
