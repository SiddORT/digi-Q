import { useState } from "react";
import { TabIcon } from "../TabIcon";
import "../tab-presentation.css";
import { tabListKeyDown } from "../../lib/tabs-a11y";
import { useTabStripVisibility } from "../../lib/tab-strip-visibility";
import { HelpTip } from "../HelpTip";
import { CompactDayEditor } from "./CompactDayEditor";
import type { OpeningHour } from "./week-days";
import { applyWeekTo, prefillFromHours, type DraftDay } from "./week-plan";
import type { RegistrationDay } from "../ClinicRegistrationHours";

export const openingFromRegistration = (hours: RegistrationDay[]): OpeningHour[] =>
  hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));

/**
 * Onboarding/registration adapter over the shared session controls and copy helpers.
 * (copy location hours once, copy a day, copy to other locations), held as a draft until Finish.
 * Finish sends it once as ownerCustomSchedule; the server saves it in the onboarding transaction.
 */
export function OwnerWeeklySessions({ branches, weeks, onChange, preferences, template }: {
  branches: { name: string; hours: RegistrationDay[]; timezone?: string }[]; weeks: DraftDay[][]; onChange: (update: (current: DraftDay[][]) => DraftDay[][]) => void; preferences: any; template?: Record<string, unknown>;
}) {
  const [active, setActive] = useState(0);
  const [targets, setTargets] = useState<number[]>([]);
  const [selected, setSelected] = useState(1);
  const index = Math.min(active, branches.length - 1);
  const tabStrip = useTabStripVisibility(index);
  const selectLocation = (id: string) => { setActive(Number(id)); setTargets([]); };
  const opening = openingFromRegistration(branches[index].hours);
  // Value and validity callbacks can share an event; compose both against the
  // adapter's latest draft rather than overwriting with captured render props.
  const setWeek = (update: (week: DraftDay[]) => DraftDay[]) => onChange(current=>current.map((w, i) => i === index ? update(w) : w));
  return <div className="owner-weekly" data-testid="owner-weekly-sessions">
    {branches.length > 1 && <div ref={tabStrip} className="dq-tabs" role="tablist" aria-label="Location" onKeyDown={e=>tabListKeyDown(e,branches.map((_,i)=>String(i)),String(index),selectLocation)}>{branches.map((b, i) => <button type="button" role="tab" tabIndex={i===index?0:-1} aria-selected={i === index} className="dq-tab" key={i} onClick={() => selectLocation(String(i))} data-testid={`tab-owner-location-${i}`}><TabIcon name="locations"/>{b.name || `Location ${i + 1}`}</button>)}</div>}
    <div className="schedule-source" role="group" aria-label="Location hours">
      <button type="button" className="button secondary small" disabled={!opening.length} onClick={() => setWeek(w => prefillFromHours(w, opening))} data-testid="button-copy-opening-hours">Copy Location Hours Once</button>
      <HelpTip label="About copying location hours" text="Copy once fills these sessions with this location's opening hours. Later location-hour changes do not update them. Nothing is saved until you finish registration."/>
      {branches.length > 1 && <details data-testid="details-copy-locations"><summary>Copy to Other Locations</summary><div className="registration-inline">
        {branches.map((b, i) => i === index ? null : <label className="registration-check" key={i}><input type="checkbox" checked={targets.includes(i)} onChange={e => setTargets(c => e.target.checked ? [...c, i] : c.filter(x => x !== i))} data-testid={`check-copy-location-${i}`}/>{b.name || `Location ${i + 1}`}</label>)}
        <button type="button" className="button secondary small" disabled={!targets.length} onClick={() => { onChange(current=>current.map((w, i) => targets.includes(i) ? applyWeekTo(w, current[index],{source:branches[index].timezone,target:branches[i].timezone}) : w)); setTargets([]); }} data-testid="button-apply-locations">Apply to Selected Locations</button>
      </div></details>}
    </div>
    <CompactDayEditor key={index} week={weeks[index]} setWeek={setWeek} opening={opening} preferences={{...preferences, timezone: branches[index].timezone}} template={template} selected={selected} onSelect={setSelected}/>
  </div>;
}
