import { Link } from "wouter";
import { OverflowText } from "./OverflowText";

/** Compact record cell: human context only, except the superadmin clinic code. */
export function ResourceRecord({ resource, row, column, columns, portal, superadminClinics, clinicHref }: {
  resource: string;
  row: Record<string, any>;
  column: string;
  columns: string[];
  portal: string;
  superadminClinics: boolean;
  clinicHref: string;
}) {
  const keys: Record<string, string[]> = {
    clinics: ["city"], branches: ["clinicName"], doctors: ["specializationName"],
    patients: ["mobile", "email"], users: ["email"], masters: [],
    qrs: ["clinicName", "branchName", "doctorName"],
  };
  const key = (keys[resource] || []).find(k => row[k] && !columns.includes(k));
  const secondary = superadminClinics
    ? (row.code ? `Code: ${row.code}` : "Code not set")
    : key ? String(row[key]) : "";

  return <div className="admin-record">
    <strong>{resource === "clinics" && portal === "admin"
      ? <Link href={clinicHref}><OverflowText value={row[column]} /></Link>
      : <OverflowText value={row[column]} testId={`text-${resource}-name-${row.id}`} />}</strong>
    {secondary && <small><OverflowText value={secondary} /></small>}
  </div>;
}
