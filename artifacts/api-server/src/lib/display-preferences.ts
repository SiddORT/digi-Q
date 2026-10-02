/** Display preferences never alter stored calendar dates, session clocks or instants. */
export function clinicDisplayPreferences(clinic: any) {
  const dateFormats = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
  const source = clinic?.data ? { ...clinic.data, ...clinic } : clinic;
  return {
    dateFormat: dateFormats.includes(source?.dateFormat) ? source.dateFormat : "DD MMM YYYY",
    timeFormat: source?.timeFormat === "24h" ? "24h" : "12h",
  };
}