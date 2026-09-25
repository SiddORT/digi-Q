export function selectInputValue(value: unknown): string {
  return value == null ? "" : String(value);
}

// Empty nullable controls must explicitly clear the stored value on PATCH.
export function emptyFieldValue(field: { key: string; nullable?: boolean }, value: unknown): Record<string, null> {
  if (value === "" || value === undefined || value === null) {
    return field.nullable ? { [field.key]: null } : {};
  }
  return {};
}

export const scheduleBreakFields = [
  { key: "breakStart", type: "time", nullable: true },
  { key: "breakEnd", type: "time", nullable: true },
];