import { createHash, randomBytes } from "node:crypto";

// Only for unrelated schedule/metadata/email tests that begin AFTER phone proof.
// owner-mobile.integration.test.mjs exercises real OTP request/confirm with fake transport.
export async function seedOwnerMobileProof(pg, flow, binding, mobile = "+919876543210") {
  const id = randomBytes(18).toString("base64url");
  const subject = createHash("sha256").update(JSON.stringify([flow,binding])).digest("hex");
  await pg.query(`insert into auth_challenges(id,email,purpose,token_hash,data,expires_at,consumed_at)
    values($1,'','owner-mobile',$2,$3,now()+interval '10 minutes',now())`,
  [id,"fixture-not-an-otp",JSON.stringify({subject,mobile,deliveryReady:true,verified:true})]);
  return id;
}
export function withOwnerMobileFixture(h) {
  const original=h.call;
  h.call=async (actor,method,path,body,headers) => {
    if(method==="POST"&&path==="/clinic-admin-onboarding"&&!body.mobileProofId) {
      body.admin.mobile ||= "+919876543210";
      body.mobileProofId=await seedOwnerMobileProof(h.pg,"admin",actor,body.admin.mobile);
    }
    return original(actor,method,path,body,headers);
  };
}
