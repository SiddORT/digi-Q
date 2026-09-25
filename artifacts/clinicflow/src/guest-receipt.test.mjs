import assert from "node:assert/strict";
import test from "node:test";
import { canPollGuestReceipt, guestReceiptText } from "./guest-receipt.ts";

test("receipt polling waits for persisted success, including uncertain-create reloads",()=>{
 const secret="a".repeat(64);
 assert.equal(canPollGuestReceipt(false,secret,true),false);
 assert.equal(canPollGuestReceipt(false,secret,false),false);
 assert.equal(canPollGuestReceipt(true,secret,true),false);
 assert.equal(canPollGuestReceipt(true,secret,false),true);
 assert.equal(canPollGuestReceipt(true,undefined,false),false);
 assert.equal(canPollGuestReceipt(true,"old-invalid-secret",false),false);
});

const receipt={id:"request",status:"pending",fullName:"A Patient",clinicName:"Clinic",branchName:"Branch",doctorName:"Doctor",date:"2030-01-01",startTime:"09:00",endTime:"12:00",timezone:"UTC",token:null,reason:null};
test("pending receipt never implies confirmation or reserved capacity",()=>{
 const text=guestReceiptText({...receipt,token:"unexpected-token"});
 assert.match(text,/Awaiting reception confirmation/);
 assert.match(text,/no token or queue place reserved/);
 assert.doesNotMatch(text,/unexpected-token/);
});
test("confirmed receipt prints token but never capability or private fields",()=>{
 const text=guestReceiptText({...receipt,status:"confirmed",token:"A001",receiptSecret:"secret-value",appointmentId:"private-id",email:"private-contact"});
 assert.match(text,/Confirmed · Token A001/);
 for(const privateValue of ["secret-value","private-id","private-contact"])assert.equal(text.includes(privateValue),false);
});
test("declined receipt shows the staff reason without issuing a token",()=>{
 const text=guestReceiptText({...receipt,status:"rejected",reason:"Please call reception",token:"unissued"});
 assert.match(text,/Declined: Please call reception/);
 assert.doesNotMatch(text,/unissued/);
});