import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import jsQR from "jsqr";
import { GuestBooking } from "../src/components/GuestBooking";
import { AppointmentTicket } from "../src/components/appointments/AppointmentTicket";
import { BulkAppointments } from "../src/components/appointments/BulkAppointments";

// Test-only browser entry: no application router, Clerk, production API or credentials.
const query = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
const params = new URLSearchParams(location.search);
const mode = params.get("mode");
if (mode !== "guest" && mode !== "appointment" && mode !== "bulk") throw new Error(`Unknown ticket fixture: ${mode}`);

declare global {
  interface Window {
    decodeTicketQr: (uri: string) => Promise<string | null>;
  }
}
window.decodeTicketQr = async (uri) => {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, canvas.width, canvas.height)?.data ?? null;
};

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={query}>
    {mode === "guest"
      ? <GuestBooking reference="fixture-qr" context={{ clinicId: "clinic-1", branchId: "branch-1", doctorId: "doctor-1", branchTimezone: "UTC", dateFormat: "DD/MM/YYYY", timeFormat: "24h" } as React.ComponentProps<typeof GuestBooking>["context"]} />
      : mode === "bulk" ? <BulkAppointments ids={["appointment-3", "appointment-1", "appointment-2"]} disabled={false} onClear={() => {}} />
      : <AppointmentTicket id="appointment-1" />}
  </QueryClientProvider>,
);