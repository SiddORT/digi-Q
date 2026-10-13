import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { build } = createRequire(new URL("../../../api-server/package.json", import.meta.url))("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const out = new URL(`.template-drawer-${process.pid}.cjs`, import.meta.url);
await build({ entryPoints: [new URL("TemplateDrawerFields.tsx", import.meta.url).pathname], outfile: out.pathname, bundle: true, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" } });
const { TemplateDrawerFields } = require(out.pathname);
after(() => rm(out, { force: true }));
const form = { subject: "DigiQ notice", prefix: "Saved prefix", body: "Hi {{patient_name}} <script>not executed</script>", footer: "Saved footer", logoUrl: "", enabled: true, senderId: "DIGIQ", dltTemplateId: "draft-template", dltEntityId: "entity-fixture" };
const render = sms => renderToStaticMarkup(React.createElement(TemplateDrawerFields, { form, sms, errors: {}, variables: ["patient_name"], scopeName: "Fictional Clinic", set: () => {}, templateKey: "booking", savedDltTemplateId: "published-template", active: React.createElement("div", { "data-testid": "active-fixture" }, "Active") }));
test("email drawer puts summary and Active before subject/body without rendering HTML", () => {
  const html = render(false);
  assert.ok(html.indexOf("panel-template-summary") < html.indexOf("active-fixture"));
  assert.ok(html.indexOf("active-fixture") < html.indexOf("input-subject"));
  assert.match(html, /Email Body/); assert.match(html, /button-toggle-preview/);
  assert.match(html, /&lt;script&gt;not executed&lt;\/script&gt;/);
  assert.ok(!html.includes("<script>")); assert.ok(!html.includes("block-dlt"));
  for (const id of ["input-prefix", "input-footer", "input-logoUrl"]) assert.ok(!html.includes(id));
});
test("SMS drawer shows published DLT summary, editable current IDs, then its body", () => {
  const html = render(true);
  assert.match(html, /text-saved-dlt[^>]*>published-template/);
  assert.match(html, /value="draft-template"/); assert.match(html, /value="entity-fixture"/);
  assert.ok(html.indexOf("active-fixture") < html.indexOf("block-dlt"));
  assert.ok(html.indexOf("input-dltEntityId") < html.indexOf("input-body"));
  assert.match(html, /Indian SMS Compliance/); assert.match(html, /SMS Body/);
  assert.match(html, /maxLength="1600"/i); assert.ok(!html.includes("input-subject"));
});
test("drawer exposes the separate visit placeholders supplied by the catalog", () => {
  const variables=["recipient_name","appointment_date","session_start","session_end","previous_date","previous_session_start","previous_session_end","queue_token","token_number"];
  const html=renderToStaticMarkup(React.createElement(TemplateDrawerFields,{form,sms:true,errors:{},variables,scopeName:"Fictional Clinic",set:()=>{},templateKey:"rescheduled",active:null}));
  for(const variable of variables)assert(html.includes(`{{${variable}}}`));
  assert.match(html,/help-trigger|Help|help/i);
});
