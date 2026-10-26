import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";

const compiled = await build({
  stdin: {
    contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { AppointmentDetails } from "./AppointmentDetails";
      export { setAuthorized } from "@workspace/api-client-react";
      export const render = appointment => renderToStaticMarkup(createElement(AppointmentDetails, { appointment }));
    `,
    resolveDir: import.meta.dirname,
  },
  write: false, platform: "node", format: "cjs", bundle: true,
  loader: { ".css": "empty" },
  packages: "external", jsx: "automatic",
  plugins: [{
    name: "private-detail-dependencies",
    setup(b) {
      b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: "api", namespace: "fixture" }));
      b.onResolve({ filter: /\/resources$/ }, () => ({ path: "resources", namespace: "fixture" }));
      b.onResolve({ filter: /^\.\/AppointmentTicket$/ }, () => ({ path: "ticket", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        contents: path === "api" ? `
          let authorized = {};
          export const setAuthorized = value => { authorized = value; };
          export const useGetAppointment = () => authorized;
          export const getGetAppointmentQueryKey = id => [id];
        ` : path === "resources" ? `
          export const title = value => value;
          export const ErrorNotice = () => "Details unavailable";
        ` : "export const AppointmentTicket = () => null;",
      }));
    },
  }],
});
const testModule = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), testModule, testModule.exports);
const { render, setAuthorized } = testModule.exports;
const appointment = {
  id: "visit", patientName: "Patient", reference: "REF", status: "waiting",
  createdAt: "2030-01-07T12:00:00Z",
  patientMobile: "+14155552671", mobile: "+14155552672",
};

test("default Booking tab shows only the saved visit mobile as read-only text", () => {
  setAuthorized({});
  const html = render({ ...appointment, bookingMobile: "+919876543210" });
  assert.match(html, /Visit contact mobile/);
  assert.match(html, /data-testid="text-detail-booking-mobile">\+919876543210/);
  assert.match(html, /separate from profile\/login contact/);
  assert.match(html, /Does not determine notification recipients/);
  assert.doesNotMatch(html, /1415555267|<input|href="tel:/);
});

test("historical absent, null and blank visit mobiles never fall back to profile contact", () => {
  setAuthorized({});
  for (const bookingMobile of [undefined, null, "", " "]) {
    const html = render({ ...appointment, bookingMobile });
    assert.match(html, /Not recorded for this visit\./);
    assert.doesNotMatch(html, /1415555267/);
  }
});

test("permission-checked detail refresh replaces the initial appointment projection", () => {
  setAuthorized({ data: { ...appointment, bookingMobile: "+919876543211" } });
  const html = render({ ...appointment, bookingMobile: "+919876543210" });
  assert.match(html, /\+919876543211/);
  assert.doesNotMatch(html, /\+919876543210/);
});

test("access loss hides the visit contact rather than using the initial record", () => {
  for (const status of [401, 403, 404]) {
    setAuthorized({ error: { status } });
    const html = render({ ...appointment, bookingMobile: "+919876543210" });
    assert.match(html, /Retry Details/);
    assert.doesNotMatch(html, /Visit contact mobile|919876543210/);
  }
});
