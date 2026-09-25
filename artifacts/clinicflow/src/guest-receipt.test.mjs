import assert from "node:assert/strict";
import test from "node:test";
import { canPollGuestReceipt } from "./guest-receipt.ts";

test("receipt polling waits for persisted success, including uncertain-create reloads",()=>{
 const secret="a".repeat(64);
 assert.equal(canPollGuestReceipt(false,secret,true),false);
 assert.equal(canPollGuestReceipt(false,secret,false),false);
 assert.equal(canPollGuestReceipt(true,secret,true),false);
 assert.equal(canPollGuestReceipt(true,secret,false),true);
 assert.equal(canPollGuestReceipt(true,undefined,false),false);
 assert.equal(canPollGuestReceipt(true,"old-invalid-secret",false),false);
});
