/** Safe variable substitution shared by email and SMS previews: clinic_name uses the scope name, other variables become explicit placeholders. No HTML is interpreted. */
export function previewText(text: string, scopeName: string) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, name: string) => name === "clinic_name" ? scopeName : `[${name.replace(/_/g, " ")}]`);
}
