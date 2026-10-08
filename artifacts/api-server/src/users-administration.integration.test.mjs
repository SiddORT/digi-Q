// Real route authorization, SQL, and native-session resolution on a disposable migrated database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
let h;
before(async()=>{h=await createFeatureHarness({administration:true});await seedFeatureFixtures(h.pg);});
after(async()=>await h?.close());
const body=(id,role,status)=>({fullName:id,email:`${id}@test.invalid`,role,status});
test("directory and policies are Super Admin only; policy lists the read-only Super Admin",async()=>{
  for(const id of [null,"adm","docu","rec","patu"]){
    for(const path of ["/management/system-users","/management/custom-roles","/management/permissions"])
      assert.equal((await h.call(id,"GET",path)).status,id?403:401);
    assert.equal((await h.call(id,"PUT","/management/custom-roles",{revision:0,roles:[],bindings:[]})).status,id?403:401);
    assert.equal((await h.call(id,"PUT","/management/permissions",{revision:0,denied:[]})).status,id?403:401);
    assert.equal((await h.call(id,"PATCH","/users/sa",body("sa","superAdmin","inactive"))).status,id?403:401);
  }
  const policy=await h.call("sa","GET","/management/permissions");
  assert.ok(policy.data.roles.includes("superAdmin"));
  assert.equal((await h.call("sa","PUT","/management/permissions",{revision:policy.data.revision,denied:["superAdmin:users:update"]})).status,400);
  const saved=await h.call("sa","PUT","/management/permissions",{revision:policy.data.revision,denied:[]});
  assert.equal(saved.status,200);assert.deepEqual(saved.data.roles,policy.data.roles,"save cache retains every system role");
  assert.equal((await h.call("sa","PUT","/management/permissions",{revision:policy.data.revision,denied:[]})).status,409);
  const directory=await h.call("sa","GET","/management/system-users");
  assert.ok(directory.data.data.every(u=>u.role!=="patient"));
});
test("custom-role saves retain revision conflicts and cannot grant capabilities or cross clinic ownership",async()=>{
  const base=(await h.call("sa","GET","/management/custom-roles")).data;
  const role={id:"limited",name:"Limited Desk",baseRole:"receptionist",denied:["patients:update"]};
  const payload={revision:base.revision,roles:[role],bindings:[{roleId:"limited",userId:"rec",clinicId:"c1"}]};
  const saved=await h.call("sa","PUT","/management/custom-roles",payload);
  assert.equal(saved.status,200);
  assert.equal((await h.call("sa","PUT","/management/custom-roles",payload)).status,409);
  assert.equal((await h.call("sa","PUT","/management/custom-roles",{...payload,revision:saved.data.revision,bindings:[{roleId:"limited",userId:"rec",clinicId:"c3"}]})).status,400);
  assert.equal((await h.call("sa","PUT","/management/custom-roles",{...payload,revision:saved.data.revision,roles:[{...role,allowed:["users:create"]}]})).status,400);
  assert.equal((await h.call("sa","PUT","/management/custom-roles",{...payload,revision:saved.data.revision,roles:[{...role,baseRole:"superAdmin"}]})).status,400);
});
test("self-deactivation is blocked on update and delete even with a second active Super Admin",async()=>{
  await h.pg.exec(`insert into users(id,email,full_name,role,status) values('sa2','sa2@test.invalid','Other Super Admin','superAdmin','active')`);
  for(const method of ["PATCH","DELETE"]){
    const result=await h.call("sa",method,"/users/sa",method==="PATCH"?body("sa","superAdmin","inactive"):undefined);
    assert.equal(result.status,409);assert.match(result.data.error,/own account/i);
  }
  await h.pg.exec(`update users set status='inactive' where id='sa2'`);
  const result=await h.call("sa2","PATCH","/users/sa",body("sa","superAdmin","inactive"));
  assert.equal(result.status,403,"inactive actor cannot update");
  // A direct route invocation for another account cannot disable the sole active admin.
  await h.pg.exec(`update users set status='active' where id='sa2'`);
  assert.equal((await h.call("sa","PATCH","/users/sa2",body("sa2","superAdmin","inactive"))).status,200);
  assert.equal((await h.pg.query(`select status from users where id='sa'`)).rows[0].status,"active");
});
test("clinic and staff ownership blocks Clinic Admin deactivation",async()=>{
  const result=await h.call("sa","PATCH","/users/adm",body("adm","clinicAdmin","inactive"));
  assert.equal(result.status,409);assert.match(result.data.error,/ownership/i);
  await h.pg.exec(`insert into users(id,email,full_name,role,status) values('staffowner','staffowner@test.invalid','Staff Owner','clinicAdmin','active');insert into users(id,email,full_name,role,status,managing_admin_id) values('unassigneddesk','unassigneddesk@test.invalid','Unassigned Desk','receptionist','active','staffowner')`);
  const staff=await h.call("sa","PATCH","/users/staffowner",body("staffowner","clinicAdmin","inactive"));
  assert.equal(staff.status,409);assert.match(staff.data.error,/ownership/i);
});
test("last active Super Admin guard handles an already-authorized request after the caller is concurrently disabled",async()=>{
  await h.pg.exec(`update users set status='active' where id='sa2'`);
  h.beforeTransaction(()=>h.pg.exec(`update users set status='inactive' where id='sa2'`));
  const result=await h.call("sa2","PATCH","/users/sa",body("sa","superAdmin","inactive"));
  assert.equal(result.status,409);assert.match(result.data.error,/last active super administrator/i);
  assert.equal((await h.pg.query(`select status from users where id='sa'`)).rows[0].status,"active");
});
test("deactivation revokes real native sessions; reactivation preserves credentials, roles and assignments",async()=>{
  const token=randomBytes(32).toString("base64url");
  const hash=createHash("sha256").update(token).digest("hex");
  await h.pg.query(`insert into auth_sessions(token_hash,user_id,expires_at) values($1,'rec',now()+interval '1 day')`,[hash]);
  const before=(await h.pg.query(`select * from users where id='rec'`)).rows[0];
  const assignments=(await h.pg.query(`select * from assignments where user_id='rec'`)).rows;
  const headers={cookie:`digiq_session=${token}`};
  assert.equal((await h.call(null,"GET","/users/rec",undefined,headers)).status,200);
  assert.equal((await h.call("sa","PATCH","/users/rec",body("rec","receptionist","inactive"))).status,200);
  assert.ok((await h.pg.query(`select revoked_at from auth_sessions where token_hash=$1`,[hash])).rows[0].revoked_at);
  assert.equal((await h.call(null,"GET","/users/rec",undefined,headers)).status,401);
  assert.equal((await h.call("sa","PATCH","/users/rec",{...body("rec","receptionist","active"),fullName:before.full_name})).status,200);
  assert.equal((await h.call(null,"GET","/users/rec",undefined,headers)).status,401);
  const after=(await h.pg.query(`select * from users where id='rec'`)).rows[0];
  for(const key of ["email","role","password_hash","managing_admin_id"])assert.equal(after[key],before[key],key);
  assert.deepEqual((await h.pg.query(`select * from assignments where user_id='rec'`)).rows,assignments);
  assert.ok((await h.pg.query(`select count(*)::int n from audit_logs where entity_id='rec'`)).rows[0].n>=2);
});
