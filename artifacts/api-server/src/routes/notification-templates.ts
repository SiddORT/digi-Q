import { Router } from "express";
import { requireUser } from "../lib/auth";
import { assert } from "../lib/http";
import { consumeRateLimit } from "../lib/native-auth";
import { saveTemplate, templateCatalog } from "../lib/notification-template-store";
import { templateRecipients, type TemplateRecipient } from "../lib/notification-templates";
import { roles } from "../lib/auth";
import { ipKeyGenerator } from "express-rate-limit";
import { eventControls,eventControlInput,prepareTemplateTest,testTemplate } from "../lib/notification-controls";
import { changeActivation } from "../lib/notification-template-store";
export const notificationTemplatesRouter = Router();
notificationTemplatesRouter.get("/management/templates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  assert(req.query.clinicId === undefined || typeof req.query.clinicId === "string", 400, "Invalid clinic");
  assert(req.query.recipient === undefined || (templateRecipients as readonly unknown[]).includes(req.query.recipient), 400, "Invalid recipient group");
  assert(req.query.channel === undefined || ["email","sms"].includes(String(req.query.channel)),400,"Invalid channel");
  res.json(await templateCatalog(user, req.query.clinicId as string | undefined, req.query.recipient as TemplateRecipient | undefined,req.query.channel==="sms"?"sms":"email"));
});
notificationTemplatesRouter.put("/management/templates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  await consumeRateLimit(`template-edit:${user.id}`, 30, 900_000);
  res.json(await saveTemplate(user, req.body));
});
notificationTemplatesRouter.get("/management/event-controls",async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  const user=await requireUser(req);roles(user,["superAdmin"]);
  assert(req.query.clinicId===undefined||typeof req.query.clinicId==="string",400,"Invalid clinic");
  res.json(await eventControls(user,req.query.clinicId as string|undefined));
});
notificationTemplatesRouter.put("/management/event-controls",async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  const user=await requireUser(req);roles(user,["superAdmin"]);
  await consumeRateLimit(`event-control:${user.id}`,30,900000);
  const input=eventControlInput.parse(req.body);
  await changeActivation(user,input);
  res.json(await eventControls(user,input.clinicId));
});
notificationTemplatesRouter.post("/management/templates/preview",async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  const user=await requireUser(req);roles(user,["superAdmin"]);
  await consumeRateLimit(`template-preview:${user.id}`,60,900000);
  const prepared=await prepareTemplateTest(user,req.body);
  res.json({status:"preview",message:"Preview only. Nothing sent or activated.",subject:prepared.rendered.subject,body:prepared.rendered.text});
});
notificationTemplatesRouter.post("/management/templates/test",async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  const user=await requireUser(req);roles(user,["superAdmin"]);
  await consumeRateLimit(`template-test:${user.id}`,3,900000);
  await consumeRateLimit(`template-test:ip:${ipKeyGenerator(req.ip||"unknown")}`,10,900000);
  res.json(await testTemplate(user,await prepareTemplateTest(user,req.body)));
});