import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, statusInput } from "./admin-listing-data.ts";

test("selected CSV guards formula prefixes including hidden whitespace",()=>{
  for(const input of ["=SUM(A1:A2)","+cmd","-1","@SUM(A1)","\t=1","\r\n+cmd"," \u0000@cmd"]){
    assert.equal(csvCell(input).startsWith('"\'') ,true);
  }
  assert.equal(csvCell('A "quoted", name'),'"A ""quoted"", name"');
  assert.equal(csvCell(["a","b"]),'"a; b"');
  assert.equal(csvCell(null),'""');
});
test("status inputs preserve branch timezone and omit assignments and ownership",()=>{
  const row={name:"Branch",address:"Address",clinicId:"clinic",timezone:"Europe/London",adminId:"owner",clinicIds:["partial"],branchIds:["partial"],ownerAdminId:"owner",fullName:"Doctor",email:"doctor@example.org",mobile:"123",role:"receptionist"};
  assert.deepEqual(statusInput("branches",row,"inactive"),{name:"Branch",address:"Address",clinicId:"clinic",timezone:"Europe/London",status:"inactive"});
  assert.deepEqual(statusInput("clinics",row,"active"),{name:"Branch",address:"Address",status:"active"});
  assert.deepEqual(statusInput("doctors",row,"inactive"),{fullName:"Doctor",email:"doctor@example.org",mobile:"123",status:"inactive"});
  assert.deepEqual(statusInput("users",row,"active"),{fullName:"Doctor",email:"doctor@example.org",mobile:"123",role:"receptionist",status:"active"});
  assert.throws(()=>statusInput("patients",row,"inactive"),/not supported/);
});