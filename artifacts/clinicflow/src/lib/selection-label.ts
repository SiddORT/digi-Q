/** Display text is never an entity's submission value. */
export function readableLabel(label: unknown, value?: string): string {
  const text = typeof label === "string" ? label.trim() : "";
  if (!text || (value && text === value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) ||
      /^[0-9a-f]{8}-[0-9a-f-]{27}(?: · Inactive)?$/i.test(text)) return "";
  return text;
}

export function recordLabel(record: { name?: unknown; fullName?: unknown; id?: string; token?: unknown; doctorName?: unknown; branchName?: unknown; date?: unknown; startTime?: unknown; reference?: unknown }, appointment = false): string {
  const name = readableLabel(record.name || record.fullName, record.id);
  if (name && name !== record.id) return name;
  if (appointment) return [
    record.token != null ? `Token ${record.token}` : "",
    record.doctorName, record.branchName, record.date, record.startTime, record.reference,
  ].map(part => readableLabel(typeof part === "string" ? part : "")).filter(Boolean).join(" · ") || "Appointment details unavailable";
  return "Name unavailable";
}
