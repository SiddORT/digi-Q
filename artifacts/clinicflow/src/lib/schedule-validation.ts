import { required, validateNumberRange } from "./validators.ts";

/** Validate the complete record independently of whether a control is currently visible. */
export function scheduleFormErrors(values: Record<string, any>, fields: { key: string; type?: string; required?: boolean; disabled?: boolean }[]): Record<string,string> {
  const errors: Record<string,string> = {};
  for (const field of fields) {
    if (field.disabled) continue;
    const value=values[field.key];
    let error=field.required?required()(value):undefined;
    if (!error && field.type==="number") error=validateNumberRange(value,{min:field.key==="maxTokens"?1:0,max:field.key==="maxTokens"?1000:field.key==="bufferMinutes"?1440:undefined,integer:true});
    if (!error && field.type==="time") {
      const timeError=scheduleTimeError(field.key,value,values);
      if(timeError!==true)error=timeError;
    }
    if (error) errors[field.key]=error;
  }
  return errors;
}

/** Mirror the existing single-session time rules; the server remains authoritative. */
export function scheduleTimeError(key: string, value: string, values: Record<string, any>): string | true {
  if (values.isOpen === false) return true;
  const { startTime: start, endTime: end, breakStart, breakEnd, queueOpenTime } = values;
  if (key === "endTime" && start && value && start >= value) return "Closing time must follow opening time.";
  if (key === "breakStart" || key === "breakEnd") {
    if (!!breakStart !== !!breakEnd) return "Both break times are required.";
    if (breakStart && breakEnd && (breakStart < start || breakEnd > end || breakStart >= breakEnd)) return "Break must lie within the session.";
  }
  if (key === "queueOpenTime" && value && end && value >= end) return "Queue opening must precede session end.";
  if (key === "queueCloseTime" && value && end && (value > end || value <= (queueOpenTime || start))) return "Queue closing must follow queue opening and be within the session.";
  return true;
}
