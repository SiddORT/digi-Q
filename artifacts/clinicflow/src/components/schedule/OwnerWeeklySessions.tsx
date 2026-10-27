import { useState } from "react";
import { TabIcon } from "../TabIcon";
import "../tab-presentation.css";
import { tabListKeyDown } from "../../lib/tabs-a11y";
import { useTabStripVisibility } from "../../lib/tab-strip-visibility";
import { HelpTip } from "../HelpTip";
import { WeeklyDraftDays, type OpeningHour } from "./WeeklyDraftDays";
import { applyWeekTo, prefillFromHours, type DraftDay } from "./week-plan";
import type { RegistrationDay } from "../ClinicRegistrationHours";

export const openingFromRegistration = (hours: RegistrationDay[]): OpeningHour[] =>
  hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));

/**
 * Onboarding/registration: the SAME weekly day editor and the same copy controls as saved schedules
 * (copy location hours once, copy a day, copy to other locations), held as a draft until Finish.
 * Finish sends it once as ownerCustomSchedule; the server saves it in the onboarding transaction.
 */
export function OwnerWeeklySessions({ branches, weeks, onChange, preferences }: {
  branches: { name: string; hours: RegistrationDay[] }[]; weeks: DraftDay[][]; onChange: (weeks: DraftDay[][]) => void; preferences: any;
}) {
  const [active, setActive] = useState(0);
  const [targets, setTargets] = useState<number[]>([]);
  const index = Math.min(active, branches.length - 1);
  const tabStrip = useTabStripVisibility(index);
  const selectLocation = (id: string) => { setActive(Number(id)); setTargets([]); };
  const opening = openingFromRegistration(branches[index].hours);
  const setWeek = (update: (week: DraftDay[]) => DraftDay[]) => onChange(weeks.map((w, i) => i === index ? update(w) : w));
  return <div className="owner-weekly" data-testid="owner-weekly-sessions">
    {branches.length > 1 && <div ref={tabStrip} className="dq-tabs" role="tablist" aria-label="Location" onKeyDown={e=>tabListKeyDown(e,branches.map((_,i)=>String(i)),String(index),selectLocation)}>{branches.map((b, i) => <button type="button" role="tab" tabIndex={i===index?0:-1} aria-selected={i === index} className="dq-tab" key={i} onClick={() => selectLocation(String(i))} data-testid={`tab-owner-location-${i}`}><TabIcon name="locations"/>{b.name || `Location ${i + 1}`}</button>)}</div>}
    <div className="schedule-source" role="group" aria-label="Location hours">
      <button type="button" className="button secondary small" disabled={!opening.length} onClick={() => setWeek(w => prefillFromHours(w, opening))} data-testid="button-copy-opening-hours">Copy Location Hours Once</button>
      <HelpTip label="About copying location hours" text="Copy once fills these sessions with this location's opening hours. Later location-hour changes do not update them. Nothing is saved until you finish registration."/>
      {branches.length > 1 && <details data-testid="details-copy-locations"><summary>Copy to Other Locations</summary><div className="registration-inline">
        {branches.map((b, i) => i === index ? null : <label className="registration-check" key={i}><input type="checkbox" checked={targets.includes(i)} onChange={e => setTargets(c => e.target.checked ? [...c, i] : c.filter(x => x !== i))} data-testid={`check-copy-location-${i}`}/>{b.name || `Location ${i + 1}`}</label>)}
        <button type="button" className="button secondary small" disabled={!targets.length} onClick={() => { onChange(weeks.map((w, i) => targets.includes(i) ? applyWeekTo(w, weeks[index]) : w)); setTargets([]); }} data-testid="button-apply-locations">Apply to Selected Locations</button>
      </div></details>}
    </div>
    <WeeklyDraftDays key={index} week={weeks[index]} setWeek={setWeek} opening={opening} clinicName={branches[index].name || "this location"} preferences={preferences}/>
  </div>;
}
