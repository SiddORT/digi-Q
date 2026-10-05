import "./queue-workspace.css";

export function StatusTabs({value,onChange,counts}:{value:string;onChange:(value:string)=>void;counts?:Record<string,number>}) {
  return <div className="sq-status-tabs" role="group" aria-label="Appointment status">
    {[["active","Active"],["waiting","Waiting"],["absent","Absent"],["completed","Completed"],["cancelled","Cancelled"],["","All"]].map(([key,label])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}>{label}{counts?.[key||"all"]!=null&&<span>{counts[key||"all"]}</span>}</button>)}
  </div>;
}
export const APPOINTMENT_STATUS_OPTIONS=[["active","Active"],["waiting","Waiting"],["absent","Absent"],["completed","Completed"],["cancelled","Cancelled"],["","All"]] as const;
/** Drawer options for appointment status; counts stay visible as read-only text in each label. */
export function appointmentStatusOptions(counts?:Record<string,number>){
  return APPOINTMENT_STATUS_OPTIONS.map(([key,label])=>({value:key||"all",label:counts?.[key||"all"]!=null?`${label} (${counts[key||"all"]})`:label}));
}
export function statusFilter(value:string) {
  return ["active","waiting","absent","completed","cancelled",""].includes(value)
    ? {statusGroup:(value||"all") as "active"|"waiting"|"absent"|"completed"|"cancelled"|"all"}
    : {status:value as import("@workspace/api-client-react").AppointmentStatus};
}