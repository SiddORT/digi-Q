export type RegistrationDay = { dayOfWeek: number; isOpen: boolean; sessions: { startTime: string; endTime: string }[] };
export const newWeek = (): RegistrationDay[] => Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: false, sessions: [] }));
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ClinicRegistrationHours({ value, onChange }: { value: RegistrationDay[]; onChange: (value: RegistrationDay[]) => void }) {
  const update = (index: number, day: RegistrationDay) => onChange(value.map((item, i) => i === index ? day : item));
  return <div className="registration-hours">{value.map((day, index) => <section key={day.dayOfWeek} className="registration-day">
    <div className="registration-day-heading"><strong>{days[day.dayOfWeek]}</strong><label className="registration-check"><input type="checkbox" checked={day.isOpen} data-testid={`hours-open-${index}`} onChange={e => update(index, { ...day, isOpen: e.target.checked, sessions: e.target.checked && !day.sessions.length ? [{ startTime: "09:00", endTime: "17:00" }] : day.sessions })}/>{day.isOpen ? "Open" : "Closed"}</label></div>
    {day.isOpen && <><div className="registration-sessions">{day.sessions.map((session, s) => <div className="registration-session" key={s}><label>Opens<input type="time" required value={session.startTime} data-testid={`hours-start-${index}-${s}`} onChange={e => update(index, { ...day, sessions: day.sessions.map((item, n) => n === s ? { ...item, startTime: e.target.value } : item) })}/></label><label>Closes<input type="time" required value={session.endTime} data-testid={`hours-end-${index}-${s}`} onChange={e => update(index, { ...day, sessions: day.sessions.map((item, n) => n === s ? { ...item, endTime: e.target.value } : item) })}/></label><button type="button" className="text-link" aria-label={`Remove ${days[index]} session ${s + 1}`} disabled={day.sessions.length === 1} data-testid={`hours-remove-${index}-${s}`} onClick={() => update(index, { ...day, sessions: day.sessions.filter((_, n) => n !== s) })}>Remove</button></div>)}</div>
    <div className="registration-inline"><button type="button" className="text-link" data-testid={`hours-add-${index}`} onClick={() => update(index, { ...day, sessions: [...day.sessions, { startTime: "", endTime: "" }] })}>Add session</button><label>Copy this day's hours to<select value="" data-testid={`hours-copy-${index}`} onChange={e => { const target = Number(e.target.value); onChange(value.map((item, n) => n === target ? { ...item, isOpen: day.isOpen, sessions: day.sessions.map(s => ({ ...s })) } : item)); }}><option value="" disabled>Choose a day</option>{days.map((name, n) => n !== index && <option key={n} value={n}>{name}</option>)}</select></label></div></>}
  </section>)}</div>;
}

export function validateWeek(week: RegistrationDay[]) {
  if (!week.some(day => day.isOpen)) return "Choose at least one open day. All-closed registration is not supported.";
  for (const day of week.filter(d => d.isOpen)) {
    const sessions = [...day.sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!sessions.length || sessions.some((s, i) => !s.startTime || !s.endTime || s.startTime >= s.endTime || (i > 0 && sessions[i - 1].endTime > s.startTime))) return `${days[day.dayOfWeek]} needs valid, non-overlapping sessions. Closing time must follow opening time.`;
  }
  return "";
}