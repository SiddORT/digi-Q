import { useState } from "react";
import { Plus, Trash2, Lock, Pencil, ChevronDown } from "lucide-react";
import "../weekly-day-rows.css";
import { IconAction } from "../IconAction";
import { TimeRangeSlider } from "../ClinicRegistrationHours";
import { TimeFormatInput } from "../DateFormatInput";
import { HelpTip } from "../HelpTip";
import { formatTime, type DateTimePreferences } from "../../lib/date-time";
import { canOpenDetails, setDayOpen, removeDaySession, openDetails, copyDay, dayErrors, dayWarnings, draftKey, outsideHours, type DraftDay, type DraftSession, type ScheduleRow } from "./week-plan";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const ORDER = [1, 2, 3, 4, 5, 6, 0];
export type OpeningHour = { dayOfWeek: number; startTime: string; endTime: string };

/**
 * Section F: the ONE weekly day/interval editor (Mon–Sun rows, multiple intervals per day, slider + exact time,
 * clinic-hour bands, outside-hours warning, copy day to selected/all days). Pure draft: it never saves.
 * Used by the saved-schedule editor (rows/onEdit given) and by onboarding/registration before any record exists.
 */
export function WeeklyDraftDays({ week, setWeek, opening, clinicName = "the clinic", preferences, busy = false, rows, onEdit, showClinicHours = true, onChange, detailsDisabled=false }: {
  week: DraftDay[]; setWeek: (update: (week: DraftDay[]) => DraftDay[]) => void; opening: OpeningHour[] | null; clinicName?: string;
  preferences: DateTimePreferences | any; busy?: boolean; rows?: ScheduleRow[]; onEdit?: (row: any) => void; showClinicHours?: boolean; onChange?: () => void; detailsDisabled?:boolean;
}) {
  const [targets, setTargets] = useState<Record<number, number[]>>({});
  const [expanded, setExpanded] = useState<number[] | null>(null);
  const fmt = (t: string) => formatTime(t, preferences);
  const hoursFor = (day: number) => (opening || []).filter(h => h.dayOfWeek === day);
  const errors = week.map(dayErrors);
  const setDay = (day: DraftDay) => { onChange?.(); setWeek(w => w.map(d => d.dayOfWeek === day.dayOfWeek ? day : d)); };
  const newSession = (_day: number): DraftSession => ({ key: draftKey(), startTime: "", endTime: "" }); // never a silent default; location hours show as bands only
  const firstOpen = ORDER.find(d => week[d].isOpen);
  const expandedDays = expanded ?? (firstOpen === undefined ? [] : [firstOpen]);
  return <>
    <div className="registration-hours wdr-list">{ORDER.map(dayIndex => {
      const day = week[dayIndex]; const hours = hoursFor(dayIndex); const errs = errors[dayIndex]; const warns = dayWarnings(day);
      // Only the explicit all-closed plan ([]) blocks; an omitted weekday is "usually closed" and allowed with a warning.
      const clinicClosed = opening !== null && opening.length === 0 && !day.sessions.some(s => s.id);
      const usuallyClosed = opening !== null && opening.length > 0 && !hours.length;
      const closedRows = (rows || []).filter(r => r.dayOfWeek === dayIndex && r.isOpen === false);
      const isExpanded = expandedDays.includes(dayIndex) || errs.length > 0; // closed rows expand to reach Copy only
      const bodyId = `week-day-body-${dayIndex}`;
      const summary = day.isOpen ? day.sessions.map(x => `${fmt(x.startTime)} – ${fmt(x.endTime)}`).join(" · ") || "No sessions yet" : clinicClosed ? "Clinic closed all days" : usuallyClosed ? "Off · clinic usually closed" : "Off";
      return <section key={dayIndex} className={`registration-day wdr-row${isExpanded ? " is-expanded" : ""}${day.isOpen ? "" : " is-off"}`} data-testid={`row-day-${dayIndex}`}>
        <div className="registration-day-heading wdr-head">
          <HelpTip text={clinicClosed ? `${clinicName} is set to closed on all days. Add opening hours in Clinic settings first.` : day.isOpen ? `Turn off to stop sessions on ${DAYS[dayIndex]}` : `Turn on to add sessions on ${DAYS[dayIndex]}`}>
            <label className="registration-check status-switch day-open-switch"><input type="checkbox" role="switch" aria-checked={day.isOpen} checked={day.isOpen} disabled={busy || clinicClosed || day.sessions.some(s => s.locked)} aria-label={`${DAYS[dayIndex]} working`} onChange={e => { setDay(setDayOpen(day, e.target.checked, () => newSession(dayIndex))); if (e.target.checked && !expandedDays.includes(dayIndex)) setExpanded([...expandedDays, dayIndex]); }} data-testid={`switch-day-${dayIndex}`}/><span className="status-switch-track" aria-hidden="true"/><span className="sr-only">{day.isOpen ? "Working" : clinicClosed ? "Clinic closed" : "Off"}</span></label>
          </HelpTip>
          <strong className="wdr-day">{DAYS[dayIndex]}</strong>
          {!isExpanded && <span className="wdr-summary" data-testid={`text-day-summary-${dayIndex}`}>{summary}</span>}
          <button type="button" className="wdr-toggle" aria-expanded={isExpanded} aria-controls={bodyId} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${DAYS[dayIndex]} sessions`} disabled={errs.length > 0} onClick={() => setExpanded(expandedDays.includes(dayIndex) ? expandedDays.filter(x => x !== dayIndex) : [...expandedDays, dayIndex])} data-testid={`button-expand-day-${dayIndex}`}><ChevronDown size={16} aria-hidden/></button>
        </div>
        {isExpanded && <div className="wdr-body" id={bodyId}>
        {showClinicHours && <small className="muted">Clinic: {opening === null ? "No hour limits set" : hours.length ? hours.map(h => `${fmt(h.startTime)} – ${fmt(h.endTime)}`).join(", ") : "Closed"}</small>}
        {closedRows.length > 0 && <small className="muted">Stored as closed: {closedRows.map(r => canOpenDetails(r) ? <button type="button" className="text-link" key={r.id} disabled={busy||detailsDisabled} title={detailsDisabled?"Save or discard the weekly draft first.":busy?"Wait for the current save to finish.":undefined} onClick={() => openDetails(r, onEdit || (() => undefined))}>{fmt(r.startTime)} – {fmt(r.endTime)}</button> : <span key={r.id}>{fmt(r.startTime)} – {fmt(r.endTime)} (linked; managed in Clinic settings) </span>)}</small>}
        {day.isOpen && <div className="registration-sessions">{day.sessions.map((s, index) => {
          const change = (patch: Partial<DraftSession>) => setDay({ ...day, sessions: day.sessions.map(x => x.key === s.key ? { ...x, ...patch } : x) });
          const row = s.id && rows ? rows.find(r => r.id === s.id) : undefined;
          const out = !s.locked && outsideHours(s, hours, opening !== null);
          const label = `${DAYS[dayIndex]} session ${index + 1}`;
          return <div className="registration-session" key={s.key} data-testid={`session-${dayIndex}-${index}`}>
            <strong>Session {index + 1}{s.locked && <span className="badge"> <Lock size={12}/> Follows clinic hours</span>}{out && <span className="badge inactive"> Outside clinic hours</span>}</strong>
            {s.locked ? <p className="muted">{fmt(s.startTime)} – {fmt(s.endTime)}. This session is linked to clinic opening hours; change it through Clinic settings.</p> : <>
              <TimeRangeSlider clinicHours={hours} startTime={s.startTime} endTime={s.endTime} label={label} onChange={change}/>
              {(["startTime", "endTime"] as const).map(key => <label key={key}>{key === "startTime" ? "Start" : "End"}<span className="required"> *</span>
                <TimeFormatInput required value={s[key]} preferences={preferences} aria-invalid={errs.length > 0} aria-describedby={errs.length ? `week-error-${dayIndex}` : undefined} disabled={busy} data-testid={`input-${key}-${dayIndex}-${index}`} onChange={value => change({ [key]: value })}/>
              </label>)}
            </>}
            <div className="row-actions">
              {row && !canOpenDetails(row) && <small className="muted" data-testid={`text-session-linked-${dayIndex}-${index}`}>Details are managed in Clinic settings for linked sessions.</small>}
              {canOpenDetails(row) && <IconAction label={`Edit details for ${label}`} hint="Edit session details" icon={<Pencil size={15} aria-hidden/>} disabled={busy||detailsDisabled} disabledReason={detailsDisabled?"Save or discard the weekly draft first.":"Wait for the current save to finish."} onClick={() => openDetails(row, onEdit || (() => undefined))} testId={`button-session-details-${dayIndex}-${index}`}/>}
              {!s.locked && <button type="button" className="text-link" aria-label={`Remove ${label}`} disabled={busy} onClick={() => setDay(removeDaySession(day, index, () => newSession(dayIndex)))} data-testid={`button-remove-session-${dayIndex}-${index}`}><Trash2 size={14}/> Remove</button>}
            </div>
            {out && <p className="notice" role="note">Allowed with warning: this time extends beyond {clinicName}'s hours ({hours.map(h => `${fmt(h.startTime)} – ${fmt(h.endTime)}`).join(", ") || `usually closed on ${DAYS[dayIndex]}`}).</p>}
          </div>;
        })}
          <button type="button" className="text-link" disabled={busy} onClick={() => setDay({ ...day, sessions: [...day.sessions, newSession(dayIndex)] })} data-testid={`button-add-session-${dayIndex}`}><Plus size={14}/> Add Session</button>
        </div>}
        {warns.length > 0 && <p className="notice" data-testid={`warning-day-${dayIndex}`}>{warns.join(" ")}</p>}
        <details><summary>Copy {DAYS[dayIndex]}</summary><div className="registration-inline">{ORDER.filter(t => t !== dayIndex).map(t => <label className="registration-check" key={t}><input type="checkbox" checked={(targets[dayIndex] || []).includes(t)} onChange={e => setTargets(c => ({ ...c, [dayIndex]: e.target.checked ? [...(c[dayIndex] || []), t] : (c[dayIndex] || []).filter(x => x !== t) }))}/>{SHORT[t]}</label>)}</div>
          <button type="button" disabled={busy || errs.length > 0 || !targets[dayIndex]?.length} onClick={() => { setWeek(w => copyDay(w, dayIndex, targets[dayIndex] || [])); setTargets(c => ({ ...c, [dayIndex]: [] })); }} data-testid={`button-copy-selected-${dayIndex}`}>Copy to Selected Days</button>
          <button type="button" disabled={busy || errs.length > 0} onClick={() => setWeek(w => copyDay(w, dayIndex, ORDER.filter(t => t !== dayIndex && !(opening !== null && !hoursFor(t).length))))} data-testid={`button-copy-all-${dayIndex}`}>Copy to All Days</button>
          <small className="muted">Copy replaces editable sessions on the chosen days in this draft only. Clinic-linked sessions are kept; days the clinic is closed are skipped by Copy to all days. Nothing is saved until you select Save weekly schedule.</small>
        </details>
        </div>}
        {!isExpanded && closedRows.length > 0 && <small className="muted wdr-body">Stored as closed: {closedRows.map(r => canOpenDetails(r) ? <button type="button" className="text-link" key={r.id} disabled={busy||detailsDisabled} title={detailsDisabled?"Save or discard the weekly draft first.":busy?"Wait for the current save to finish.":undefined} onClick={() => openDetails(r, onEdit || (() => undefined))}>{fmt(r.startTime)} – {fmt(r.endTime)}</button> : <span key={r.id}>{fmt(r.startTime)} – {fmt(r.endTime)} (linked; managed in Clinic settings) </span>)}</small>}
        {errs.length > 0 && <p id={`week-error-${dayIndex}`} className="field-error" role="alert">{errs.join(" ")}</p>}
      </section>;
    })}</div>
  </>;
}
