import { CalendarDays, List } from "lucide-react";
import "../tab-presentation.css";

/** Presentation shared with tabs; these remain ordinary pressed view buttons. */
export function AppointmentViewSelector({ mode, onSelect }: {
  mode: "list" | "calendar";
  onSelect: (mode: "list" | "calendar") => void;
}) {
  return <div className="dq-tabs dq-tabs-intrinsic" role="group" aria-label="Appointment layout">
    <button className="dq-tab" type="button" aria-pressed={mode === "list"} onClick={() => onSelect("list")} data-testid="button-mode-list"><List className="dq-tab-icon" strokeWidth={1.75} aria-hidden="true"/>List</button>
    <button className="dq-tab" type="button" aria-pressed={mode === "calendar"} onClick={() => onSelect("calendar")} data-testid="button-mode-calendar"><CalendarDays className="dq-tab-icon" strokeWidth={1.75} aria-hidden="true"/>Calendar</button>
  </div>;
}
