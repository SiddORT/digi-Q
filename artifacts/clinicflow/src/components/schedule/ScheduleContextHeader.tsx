import type { ReactNode } from "react";
import { HelpTip } from "../HelpTip";

/** Shared saved context; wrappers provide scope controls, never a second editor. */
export function ScheduleContextHeader({ doctor, doctorCode, clinic, location, timezone, timeFormat, children }: {
  doctor: string; doctorCode?: string; clinic?: string; location?: string; timezone?: string; timeFormat: string; children?: ReactNode;
}) {
  return <header className="dsc-header" data-testid="schedule-header">
    <div className="dsc-id"><small className="muted">Doctor</small><strong>{doctor}</strong>{doctorCode && <small className="muted" data-testid="text-doctor-code">{doctorCode}</small>}</div>
    <div className="dsc-scope">
      {clinic && <span className="dsc-context"><small className="muted">Clinic</small><strong data-testid="text-fixed-group">{clinic}</strong></span>}
      {location && <span className="dsc-context"><small className="muted">Location</small><strong data-testid="text-fixed-location">{location}</strong></span>}
      {children}
    </div>
    <div className="muted dsc-display-context"><span data-testid="indicator-timezone">Timezone: {timezone || "Not set"}</span> · <span data-testid="indicator-time-format">{timeFormat === "24h" ? "24-hour" : "12-hour (AM/PM)"}</span> <HelpTip label="About inherited display settings" text="Timezone and time format are inherited from clinic settings. Change them there, not in individual sessions."/></div>
  </header>;
}
