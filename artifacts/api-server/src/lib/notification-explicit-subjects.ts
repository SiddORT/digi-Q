import { sql } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Bind an explicit test destination at capture time, not by reinterpreting the
 * staff directory after a contact edit. Never use a match on rendered names. */
export async function explicitNotificationSubjects(conn: any, channel: string, recipient?: string) {
  if (!recipient) return [];
  if (channel === "email") {
    const result = await conn.execute(sql`select id from users where role<>'patient'
      and lower(trim(email))=lower(trim(${recipient}))`);
    return result.rows.map((r: any) => r.id as string);
  }
  const phone = parsePhoneNumberFromString(recipient, "IN");
  if (!phone?.isValid()) throw new Error("Explicit notification destination is invalid");
  const candidates = await conn.execute(sql`select id,mobile,data from users where role<>'patient'
    and regexp_replace(coalesce(mobile,data->>'mobile',''),'[^0-9]','','g')
      in (${phone.number.slice(1)},${phone.nationalNumber})`);
  return candidates.rows.filter((r: any) => {
    const raw = String(r.mobile || r.data?.mobile || "").trim();
    const country = String(r.data?.countryCode || "");
    const input = raw.startsWith("+") ? raw :
      /^\+?[1-9][0-9]{0,3}$/.test(country) ? "+" + country.replace("+", "") + raw.replace(/\D/g, "") : raw;
    const candidate = parsePhoneNumberFromString(input, "IN");
    return candidate?.isValid() && candidate.number === phone.number;
  }).map((r: any) => r.id as string);
}
