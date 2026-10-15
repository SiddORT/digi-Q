/** Exact known scope-gate reasons only. Provider/recipient diagnostics remain local. */
export const scopeGateReasons = new Set([
  "Clinic notification gate is off",
  "Platform default notification gate is off; clinics may have explicit overrides",
]);

export function rowDeliveryReasons(row: { blockedReasons: string[] }, gateOff: boolean) {
  return row.blockedReasons.filter(reason => reason !== "Published activation is off" && !(gateOff && scopeGateReasons.has(reason)));
}

export function activationSource(source: string, clinicId: string) {
  return source === "clinic" ? "Published clinic activation"
    : source === "platform" ? clinicId ? "Inherited system activation" : "Published system activation"
    : "Default activation";
}
