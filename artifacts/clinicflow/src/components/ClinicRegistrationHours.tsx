import { useState } from "react";
import { formatTime, isCanonicalTime, type DateTimePreferences } from "../lib/date-time";
import { TimeFormatInput } from "./DateFormatInput";
import * as Slider from "@radix-ui/react-slider";
import { useDateTimePreferences } from "./DateTimePreferences";
import { ChevronDown } from "lucide-react";
import "./weekly-day-rows.css";

export type RegistrationDay = { dayOfWeek: number; isOpen: boolean; sessions: { startTime: string; endTime: string }[] };
export const newWeek = (): RegistrationDay[] => Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: false, sessions: [] }));
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
export function TimeRangeSlider({startTime,endTime,onChange,label="Session",clinicHours=[]}:{startTime:string;endTime:string;onChange:(value:{startTime:string;endTime:string})=>void;label?:string;clinicHours?:{startTime:string;endTime:string}[]}){
 return <Slider.Root className="weekly-time-range wide" min={0} max={1440} step={15} minStepsBetweenThumbs={0} value={[isCanonicalTime(startTime)?minutes(startTime):540,isCanonicalTime(endTime)?minutes(endTime):1020]} onValueChange={values=>onChange({startTime:clock(Math.min(values[0],1439)),endTime:clock(Math.min(values[1],1439))})}><Slider.Track className="weekly-time-track">{clinicHours.filter(hour=>isCanonicalTime(hour.startTime)&&isCanonicalTime(hour.endTime)).map((hour,index)=><span key={index} aria-hidden="true" style={{position:"absolute",left:`${minutes(hour.startTime)/1440*100}%`,width:`${(minutes(hour.endTime)-minutes(hour.startTime))/1440*100}%`,height:14,top:-4,background:"#a8c8ae",borderRadius:3}}/>)}<Slider.Range className="weekly-time-fill"/></Slider.Track><Slider.Thumb className="weekly-time-thumb" aria-label={`${label} opening time`}/><Slider.Thumb className="weekly-time-thumb" aria-label={`${label} closing time`}/></Slider.Root>;
}
export function dayError(day: RegistrationDay) {
  if (!day.isOpen) return "";
  const sessions = [...day.sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return !sessions.length || sessions.some((s, i) => !isCanonicalTime(s.startTime) || !isCanonicalTime(s.endTime) || s.startTime >= s.endTime || (i > 0 && sessions[i - 1].endTime > s.startTime))
    ? "Enter non-overlapping sessions. Closing time must follow opening time." : "";
}

export function ClinicRegistrationHours({ value, onChange, timezone, preferences }: { value: RegistrationDay[]; onChange: (value: RegistrationDay[]) => void; timezone?: string; preferences?: Partial<DateTimePreferences> }) {
  const inherited=useDateTimePreferences();
  preferences=preferences||inherited;
  const [targets, setTargets] = useState<Record<number, number[]>>({});
  const [copyNotice, setCopyNotice] = useState("");
  // Expandable weekday rows: the first open day starts expanded; days with errors always stay expanded.
  const [expanded, setExpanded] = useState<number[]>(() => { const first = [1, 2, 3, 4, 5, 6, 0].find(d => value.find(v => v.dayOfWeek === d)?.isOpen); return first === undefined ? [] : [first]; });
  const toggleExpanded = (d: number) => setExpanded(c => c.includes(d) ? c.filter(x => x !== d) : [...c, d]);
  const summary = (day: RegistrationDay) => day.isOpen ? day.sessions.filter(s => isCanonicalTime(s.startTime) && isCanonicalTime(s.endTime)).map(s => `${formatTime(s.startTime, preferences)} – ${formatTime(s.endTime, preferences)}`).join(" · ") || "No sessions yet" : "Closed";
  const update = (day: RegistrationDay) => onChange(value.map(item => item.dayOfWeek === day.dayOfWeek ? day : item));
  const copy = (day: RegistrationDay, selected: number[]) => {
    const destinations = selected.filter(target => target !== day.dayOfWeek);
    onChange(value.map(item => destinations.includes(item.dayOfWeek) ? { ...item, isOpen: day.isOpen, sessions: day.sessions.map(s => ({ ...s })) } : item));
    setTargets(current => ({ ...current, [day.dayOfWeek]: destinations }));
    setCopyNotice(`Copied ${days[day.dayOfWeek]} ${day.isOpen ? "opening hours" : "closed status"} to ${destinations.map(target => days[target]).join(", ")}. These changes are in your registration draft; finish registration to save.`);
  };
  return <div className="registration-hours wdr-list">
    {copyNotice && <p className="notice" role="status" data-testid="registration-copy-result">{copyNotice}</p>}
    {timezone && <p>Clinic timezone: {timezone}</p>}
    <p className="registration-note">Use the start and end sliders in 15-minute steps, or type exact minutes. Overnight sessions are not supported. Copy replaces the selected days' hours.</p>
    {[...value].sort((a,b) => (a.dayOfWeek + 6) % 7 - (b.dayOfWeek + 6) % 7).map(day => {
      const error = dayError(day);
      const isExpanded = expanded.includes(day.dayOfWeek) || !!error; // closed rows expand to reach Copy only
      const bodyId = `hours-day-body-${day.dayOfWeek}`;
      return <section key={day.dayOfWeek} className={`registration-day wdr-row${isExpanded ? " is-expanded" : ""}${day.isOpen ? "" : " is-off"}`} data-testid={`row-hours-day-${day.dayOfWeek}`}>
        <div className="registration-day-heading wdr-head">
          <label className="registration-check status-switch day-open-switch"><input type="checkbox" role="switch" aria-checked={day.isOpen} aria-label={`${days[day.dayOfWeek]} open`} checked={day.isOpen} data-testid={`hours-open-${day.dayOfWeek}`} onChange={e => { update({ ...day, isOpen: e.target.checked, sessions: e.target.checked && !day.sessions.length ? [{ startTime: "09:00", endTime: "17:00" }] : day.sessions }); if (e.target.checked && !expanded.includes(day.dayOfWeek)) toggleExpanded(day.dayOfWeek); }}/><span className="status-switch-track" aria-hidden="true"/><span className="sr-only">{day.isOpen ? "Open" : "Closed"}</span></label>
          <strong className="wdr-day">{days[day.dayOfWeek]}</strong>
          {!isExpanded && <span className="wdr-summary" data-testid={`text-hours-summary-${day.dayOfWeek}`}>{summary(day)}</span>}
          <button type="button" className="wdr-toggle" aria-expanded={isExpanded} aria-controls={bodyId} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${days[day.dayOfWeek]} hours`} disabled={!!error} onClick={() => toggleExpanded(day.dayOfWeek)} data-testid={`button-hours-expand-${day.dayOfWeek}`}><ChevronDown size={16} aria-hidden/></button>
        </div>
        {isExpanded && <div className="wdr-body" id={bodyId}>{day.isOpen && <div className="registration-sessions">{day.sessions.map((session, index) => {
          const change = (patch: Partial<typeof session>) => update({ ...day, sessions: day.sessions.map((item, i) => i === index ? { ...item, ...patch } : item) });
          return <div className="registration-session" key={index}>
            <TimeRangeSlider {...session} onChange={change} label={`${days[day.dayOfWeek]} Session ${index+1}`}/>
            {(["startTime", "endTime"] as const).map(key => <label key={key}>{key === "startTime" ? "Opens" : "Closes"} · {formatTime(session[key], preferences)}
              <TimeFormatInput required value={session[key]} preferences={preferences} aria-invalid={!!error} aria-describedby={error ? `hours-error-${day.dayOfWeek}` : undefined} data-testid={`hours-${key}-${day.dayOfWeek}-${index}`} onChange={value => change({ [key]: value })}/>
            </label>)}
            <button type="button" className="text-link" aria-label={`Remove ${days[day.dayOfWeek]} session ${index + 1}`} disabled={day.sessions.length === 1} onClick={() => update({ ...day, sessions: day.sessions.filter((_, i) => i !== index) })}>Remove</button>
          </div>;
        })}<button type="button" className="text-link" onClick={() => update({ ...day, sessions: [...day.sessions, { startTime: "", endTime: "" }] })}>Add Session</button></div>}
        <details><summary>Copy {days[day.dayOfWeek]} hours</summary><div className="registration-inline">{days.map((name, target) => target !== day.dayOfWeek && <label className="registration-check" key={name}><input type="checkbox" checked={(targets[day.dayOfWeek] || []).includes(target)} onChange={e => setTargets(current => ({ ...current, [day.dayOfWeek]: e.target.checked ? [...(current[day.dayOfWeek] || []), target] : (current[day.dayOfWeek] || []).filter(id => id !== target) }))}/>{name}</label>)}</div><button type="button" disabled={!!error || !targets[day.dayOfWeek]?.length} onClick={() => copy(day, targets[day.dayOfWeek] || [])}>Copy to Selected Days</button><button type="button" disabled={!!error} onClick={() => copy(day, days.map((_, i) => i))}>Copy to All Days</button></details></div>}
        {error && <p id={`hours-error-${day.dayOfWeek}`} className="field-error" role="alert">{error}</p>}
      </section>;
    })}
    <details><summary>Weekly Summary</summary>{value.map(day => <p key={day.dayOfWeek}>{days[day.dayOfWeek]}: {day.isOpen ? day.sessions.map(s => `${formatTime(s.startTime, preferences)}–${formatTime(s.endTime, preferences)}`).join(", ") : "Closed"}</p>)}</details>
  </div>;
}
export function validateWeek(week: RegistrationDay[]) {
  if (!week.some(day => day.isOpen)) return "Choose at least one open day. All-closed registration is not supported.";
  for (const day of week) { const error = dayError(day); if (error) return `${days[day.dayOfWeek]}: ${error}`; }
  return "";
}