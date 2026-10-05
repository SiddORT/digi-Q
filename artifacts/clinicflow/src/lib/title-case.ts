import { applyGlossary } from "./ui-glossary";
/** Title Case for static interface labels only. Never pass stored names, emails, URLs, IDs or free text. */
const ACRONYMS = ["QR", "OTP", "SMS", "API", "PDF", "CSV", "SMTP", "URL", "ID", "DOB", "UTC"];
const MINOR = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "per", "the", "to", "via", "vs", "with"]);
/** Brand or mixed-case words (DigiQ, WebP, iPhone) keep their own casing. */
const isMixedCase = (s: string) => /[a-z]/.test(s) && /[A-Z]/.test(s.slice(1));
export function titleCase(input: string): string {
  return applyGlossary(baseTitleCase(input));
}
function baseTitleCase(input: string): string {
  const words = input.trim().split(/(\s+)/);
  let index = 0;
  const count = words.filter(w => w.trim()).length;
  return words.map(word => {
    if (!word.trim()) return word;
    const position = index++;
    return word.split("-").map((part, partIndex) => {
      const bare = part.replace(/[^A-Za-z]/g, "");
      if (!bare) return part;
      const acronym = ACRONYMS.find(a => a === bare.toUpperCase());
      if (acronym) return part.replace(bare, acronym);
      if (isMixedCase(bare)) return part;
      const lower = part.toLowerCase();
      if (partIndex === 0 && position > 0 && position < count - 1 && MINOR.has(lower)) return lower;
      return lower.replace(/[a-z]/, c => c.toUpperCase());
    }).join("-");
  }).join("");
}
