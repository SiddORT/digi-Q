import test from "node:test";
import assert from "node:assert/strict";
import { loadModule, runtime } from "../test/load-module.mjs";

const { createElement: h } = runtime("react");
const { renderToStaticMarkup: render } = runtime("react-dom/server");
const { StaffAccountFields } = await loadModule(new URL("./StaffAccountFields.tsx", import.meta.url));
const { BookingField, bookingValidation } = await loadModule(new URL("./booking/booking-fields.tsx", import.meta.url));
const { useForm } = runtime("react-hook-form");

function Staff({ create, errors = {} }) {
  const form = useForm({defaultValues:{fullName:"Fictional Staff",email:"staff@example.invalid",mobile:"+919876543210"}});
  return h(StaffAccountFields, {control:form.control,register:form.register,getValues:form.getValues,errors,withPassword:create});
}

test("actual staff fields render create-only passwords, independent verification and linked errors", () => {
  const create = render(h(Staff,{create:true,errors:{email:{message:"Enter a valid email."}}}));
  assert.match(create, /type="email"/);
  assert.match(create, /name="email"/, "uncontrolled field values attach when mounted, not during SSR");
  for (const id of ["input-staff-password","input-staff-confirm-password","status-email-verification","status-mobile-verification"]) {
    assert.ok(create.includes(`data-testid="${id}"`), id);
  }
  assert.match(create, /Enter a valid email\./);
  assert.match(create, /aria-invalid="true"/);
  assert.match(create, /aria-describedby=/);
  const edit = render(h(Staff,{create:false}));
  assert.match(edit, /type="email"/);
  assert.doesNotMatch(edit, /input-staff-(?:confirm-)?password/);
  assert.doesNotMatch(edit, /status-(?:email|mobile)-verification/);
});

test("shared booking email renders optional metadata and exposes validation through the field", () => {
  const valid = render(h(BookingField,{name:"email"},h("input",{type:"email"})));
  assert.match(valid, /Email/);
  assert.match(valid, /optional/i);
  assert.doesNotMatch(valid, /aria-required="true"/);
  assert.equal(bookingValidation.email(""), true);
  assert.equal(bookingValidation.email("patient@example.invalid"), true);
  const error = bookingValidation.email("invalid");
  assert.equal(typeof error, "string");
  const invalid = render(h(BookingField,{name:"email",error},h("input",{type:"email"})));
  assert.match(invalid, /role="alert"/);
  assert.match(invalid, /aria-invalid="true"/);
  assert.ok(invalid.includes(error));
});
