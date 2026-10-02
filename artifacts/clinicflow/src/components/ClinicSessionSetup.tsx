import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Link } from "wouter";
import { friendlyError } from "../lib/friendly-error";
import { SearchableSelect } from "./SearchableSelect";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Hour = { dayOfWeek: number; startTime: string; endTime: string };

/** Location hours are a template, never a substitute for a doctor's bookable schedule. */
export function ClinicSessionSetup({ clinicId, branches, ownDoctorId }: {
  clinicId: string;
  branches: api.Branch[];
  ownDoctorId?: string;
}) {
  const client = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [capacity, setCapacity] = useState("");
  const [duration, setDuration] = useState("");
  const [prefix, setPrefix] = useState("A");
  // New sessions accept patient appointments as well as walk-ins.
  const queueMode = "mixed" as const;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const active = branches.filter(b => b.status === "active");
  const selectedBranch = active.find(b => b.id === branchId);
  const linkedOwner = selectedBranch?.linkedSchedule?.enabled && selectedBranch.linkedSchedule.doctorId === doctorId;
  const shifts: Hour[] = selectedBranch?.openingHours || [];
  const doctors = useQuery({
    queryKey: ["clinic-session-doctors", clinicId, branchId],
    enabled: !!branchId,
    queryFn: () => api.listDoctors({ clinicId, branchId, status: "active", pageSize: 100 }),
    staleTime: 0,
  });
  const schedules = useQuery({
    queryKey: ["clinic-session-schedules", clinicId, branchId, doctorId],
    enabled: !!branchId && !!doctorId,
    queryFn: () => api.listSchedules({ clinicId, branchId, doctorId, pageSize: 100 }),
    staleTime: 0,
    refetchInterval: 30000,
  });
  const identified = (h: Hour) => `${h.dayOfWeek}:${h.startTime}:${h.endTime}`;
  const activeSessions = (items: api.Schedule[]) => items.filter(s => (s as api.Schedule & { status?: string }).status !== "inactive");
  const bookableSessions = (items: api.Schedule[]) => activeSessions(items).filter(s => s.isOpen && s.queueMode !== "walkInsOnly");
  const existing = (h: Hour, items: api.Schedule[]) => activeSessions(items).some(s => s.dayOfWeek === h.dayOfWeek && s.startTime === h.startTime && s.endTime === h.endTime);
  const doctorOptions = doctors.data?.items || [];
  const incompleteDoctors = !!doctors.data && doctors.data.total > doctorOptions.length;
  useEffect(()=>{if(doctorId&&doctors.isSuccess&&!doctors.isFetching&&!incompleteDoctors&&!doctorOptions.some(doctor=>doctor.id===doctorId))setDoctorId("");},[doctorId,doctors.isSuccess,doctors.isFetching,doctors.data,incompleteDoctors]);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy || !selectedBranch || !doctorId || incompleteDoctors) return;
    setMessage("");
    const maxTokens = Number(capacity), consultationMinutes = Number(duration);
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || !Number.isSafeInteger(consultationMinutes) || consultationMinutes < 1 || !/^[A-Za-z0-9]{1,8}$/.test(prefix)) {
      setMessage("Enter a positive whole-number capacity and consultation duration, and a 1–8 character letter/number token prefix.");
      return;
    }
    if (!chosen.length) { setMessage("Select at least one opening-hours interval."); return; }
    setBusy(true);
    let created = 0;
    try {
      // Refresh before EACH write: a retry must not create another identical session.
      for (const key of chosen) {
        const latest = await api.listSchedules({ clinicId, branchId, doctorId, pageSize: 100 });
        if (latest.total > latest.items.length) throw new Error("The schedule has more than 100 entries. Use Weekly schedule to review it before continuing.");
        const h = shifts.find(item => identified(item) === key);
        if (!h || existing(h, latest.items)) continue;
        const overlapping = activeSessions(latest.items).some(item => item.dayOfWeek === h.dayOfWeek && item.startTime < h.endTime && h.startTime < item.endTime);
        if (overlapping) throw new Error(`${days[h.dayOfWeek]} ${h.startTime}–${h.endTime} overlaps an existing doctor session. Review Weekly schedule before continuing.`);
        await api.createSchedule({ clinicId, branchId, doctorId, dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime, isOpen: true, timezone: selectedBranch.timezone, maxTokens, consultationMinutes, tokenPrefix: prefix.toUpperCase(), queueMode });
        created++;
      }
      setMessage(created ? `Created ${created} doctor session${created === 1 ? "" : "s"}. Check the patient booking page for a future open date.` : "No new sessions were needed. Existing sessions were left unchanged.");
      setChosen([]);
    } catch (error) {
      setMessage(`${created} session${created === 1 ? "" : "s"} created before setup stopped. ${friendlyError(error,"save")} Review the schedule before retrying; saved sessions will not be recreated.`);
    } finally {
      try {
        await schedules.refetch();
        await client.invalidateQueries();
      } finally {
        setBusy(false);
      }
    }
  }
  return <section className="panel padded" aria-label="Booking readiness and doctor sessions">
    <div className="panel-heading"><div><h2>Booking readiness · doctor sessions</h2><p>Owner-linked hours are configured in Locations &amp; Hours. Custom doctors can copy saved intervals here, then manage every session below.</p></div></div>
    <div className="form-grid">
      <SearchableSelect label="Clinic" disabled={busy} value={branchId} onChange={id=>{setBranchId(id);setChosen([]);setMessage("");}} options={active.map(b=>({value:b.id,label:b.name}))}/>
      {branchId&&<SearchableSelect label="Doctor" value={doctorId} disabled={busy||incompleteDoctors} loading={doctors.isFetching} error={doctors.error?"Unable to load doctors.":undefined} onRetry={()=>void doctors.refetch()} onChange={id=>{setDoctorId(id);setChosen([]);setMessage("");}} options={doctorOptions.map(d=>({value:d.id,label:`${d.fullName}${d.id===ownDoctorId?" (you)":""}`}))}/>}
    </div>
    {(doctors.error || schedules.error) && <p role="alert">{friendlyError(doctors.error || schedules.error,"load")} <button type="button" onClick={() => { void doctors.refetch(); void schedules.refetch(); }}>Retry</button></p>}
    {branchId && doctors.isLoading && <p role="status">Loading assigned doctors…</p>}
    {incompleteDoctors && <p role="alert">Only {doctorOptions.length} of {doctors.data?.total} assigned doctors were loaded. Use Weekly schedule to find the intended doctor; bulk setup is unavailable until the complete doctor list can be shown.</p>}
    {branchId && !doctors.isLoading && !doctors.error && !doctorOptions.length && <p role="status">No active doctor is assigned to this location. Assign one in Staff management or enable your own doctor profile.</p>}
    {doctorId && schedules.isLoading && <p role="status">Checking existing doctor sessions…</p>}
    {doctorId && schedules.data && !schedules.error && <><p role="status">{bookableSessions(schedules.data.items).length ? `${bookableSessions(schedules.data.items).length} open weekly session${bookableSessions(schedules.data.items).length === 1 ? "" : "s"} allowing appointments at this location. This does not guarantee availability on every date: opening hours, exceptions, time cutoffs and remaining capacity also apply.` : "Not ready for patient bookings: no open weekly doctor sessions that allow appointments at this location."} {activeSessions(schedules.data.items).length > bookableSessions(schedules.data.items).length && <Link href="/admin/availability">Review closed or walk-ins-only sessions in Weekly schedule.</Link>}</p>
      {linkedOwner ? <p className="notice">Linked owner consultations: edit hours, capacity or booking mode in Locations &amp; Hours. Changes require an impact preview. Unlink there first if this doctor needs custom hours.</p> : !shifts.length ? <p>There are no location opening hours to copy. Set them in Locations &amp; Hours, then return here.</p> : <form onSubmit={e => { void create(e); }}>
        <p>Choose intervals from the saved location hours. Already-created sessions are left unchanged.</p>
        {shifts.map(h => { const previous = activeSessions(schedules.data.items).find(s => s.dayOfWeek === h.dayOfWeek && s.startTime === h.startTime && s.endTime === h.endTime); return <label className="check-label" key={identified(h)}><input type="checkbox" disabled={busy || !!previous} checked={chosen.includes(identified(h))} onChange={e => setChosen(current => e.target.checked ? [...current, identified(h)] : current.filter(key => key !== identified(h)))}/>{days[h.dayOfWeek]} · {h.startTime}–{h.endTime}{previous ? previous.isOpen && previous.queueMode !== "walkInsOnly" ? " · already scheduled" : " · existing session does not allow patient appointments; edit in Weekly schedule" : ""}</label>; })}
        <div className="form-grid"><label>Patients per session<input disabled={busy} type="number" required min="1" step="1" value={capacity} onChange={e => setCapacity(e.target.value)}/></label><label>Expected consultation (minutes)<input disabled={busy} type="number" required min="1" step="1" value={duration} onChange={e => setDuration(e.target.value)}/></label><label>Ticket prefix<input disabled={busy} required maxLength={8} pattern="[A-Za-z0-9]{1,8}" value={prefix} onChange={e => setPrefix(e.target.value)}/></label></div>
        <p>Queue policy: <strong>Mixed (patient appointments and walk-ins)</strong> for new sessions. You can change it later in <Link href="/admin/availability">Weekly schedule</Link>.</p>
        <button className="button" disabled={busy || incompleteDoctors || schedules.isFetching || !chosen.length || schedules.data.total > schedules.data.items.length}>{busy ? "Creating sessions…" : `Create ${chosen.length} selected session${chosen.length === 1 ? "" : "s"}`}</button>
        {schedules.data.total > schedules.data.items.length && <p role="alert">This schedule has more than 100 entries. Review it in Weekly schedule before adding sessions.</p>}
      </form>}
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}