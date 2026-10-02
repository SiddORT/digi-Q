import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type PhoneParts = { country: CountryCode | ""; national: string };

let names: Intl.DisplayNames | undefined;
try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch { names = undefined; }

/** All supported regions, sorted by English name, labelled "Name +code". */
export const phoneCountries = getCountries()
  .map(country => ({ country, code: `+${getCountryCallingCode(country)}`, name: names?.of(country) || country }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function callingCode(country: CountryCode | ""): string {
  return country ? `+${getCountryCallingCode(country)}` : "";
}

/** Browser region is a suggestion for new empty fields only. */
export function suggestedCountry(language = typeof navigator !== "undefined" ? navigator.language : ""): CountryCode | "" {
  try {
    const region = new Intl.Locale(language).region as CountryCode | undefined;
    return region && phoneCountries.some(item => item.country === region) ? region : "";
  } catch { return ""; }
}

/** Splits a stored international value into country + national digits. Unknown values stay intact as national text. */
export function splitPhone(value: string, fallback: CountryCode | "" = ""): PhoneParts {
  const raw = value.trim();
  if (!raw) return { country: fallback, national: "" };
  const parsed = raw.startsWith("+") ? parsePhoneNumberFromString(raw) : undefined;
  if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  if (parsed) {
    const match = phoneCountries.find(item => item.code === `+${parsed.countryCallingCode}`);
    if (match) return { country: fallback && callingCode(fallback) === match.code ? fallback : match.country, national: parsed.nationalNumber };
  }
  return { country: fallback, national: raw };
}

/** Composes the international onChange value. A pasted "+..." number wins over the selected country. */
export function joinPhone(country: CountryCode | "", national: string): string {
  const raw = national.trim();
  if (!raw) return "";
  if (raw.startsWith("+") || raw.startsWith("00")) return `+${raw.replace(/^00/, "").replace(/\D/g, "")}`;
  if (!country) return raw;
  const parsed = parsePhoneNumberFromString(raw, country);
  if (parsed) return parsed.number;
  return `${callingCode(country)}${raw.replace(/\D/g, "").replace(/^0+/, "")}`;
}

/** Display formatting for the local field (spacing only; digits unchanged). */
export function formatNational(country: CountryCode | "", national: string): string {
  if (!country || !national || national.startsWith("+")) return national;
  return new AsYouType(country).input(national);
}

/** Country-aware validation; returns undefined when valid or empty. */
export function phoneValidityMessage(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed) return "Choose a country and enter the local number.";
  if (!parsed.isPossible()) return "This number has the wrong length for the selected country.";
  if (!parsed.isValid()) return "Enter a valid number for the selected country.";
  return undefined;
}
