/** Schedule disclosure is semantic: computed summaries cover their constituent fields. */
export function scheduleAdditionalKeys(row: Record<string, any>, visible: string[], scope: { doctorId?: string; clinicId?: string; branchId?: string } = {}) {
  const covered = new Set(visible);
  if (scope.doctorId) covered.add("doctorName");
  if (scope.clinicId || scope.branchId) covered.add("clinicName");
  if (scope.branchId) covered.add("branchName");
  if (covered.has("session")) ["startTime", "endTime"].forEach(key => covered.add(key));
  if (covered.has("break")) ["breakStart", "breakEnd"].forEach(key => covered.add(key));
  if (covered.has("capacity")) ["tokenPrefix", "maxTokens", "consultationMinutes", "bufferMinutes"].forEach(key => covered.add(key));
  const present = (key: string) => row[key] !== undefined && row[key] !== null && row[key] !== "";
  // Show hidden summaries, never both a summary and its underlying values.
  const keys = ["doctorName", "clinicName", "branchName", "dayOfWeek", "session", "break", "capacity", "isOpen", "timezone", "queueMode", "queueOpenTime", "queueCloseTime"];
  return keys.filter(key => {
    if (covered.has(key)) return false;
    if (key === "session") return present("startTime") || present("endTime");
    if (key === "break") return present("breakStart") || present("breakEnd");
    if (key === "capacity") return ["tokenPrefix", "maxTokens", "consultationMinutes", "bufferMinutes"].some(present);
    return present(key);
  });
}
