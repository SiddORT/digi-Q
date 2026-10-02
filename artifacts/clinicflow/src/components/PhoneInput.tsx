import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { normalizePhone } from "../lib/validators";
import { SearchableSelect } from "./SearchableSelect";

const callingCodes=[["IN","+91","India"],["US","+1","United States / Canada"],["GB","+44","United Kingdom"],["AU","+61","Australia"],["NZ","+64","New Zealand"],["SG","+65","Singapore"],["AE","+971","United Arab Emirates"],["SA","+966","Saudi Arabia"],["ZA","+27","South Africa"],["DE","+49","Germany"],["FR","+33","France"],["IT","+39","Italy"],["ES","+34","Spain"],["JP","+81","Japan"],["CN","+86","China"],["MY","+60","Malaysia"],["PK","+92","Pakistan"],["BD","+880","Bangladesh"],["LK","+94","Sri Lanka"],["NP","+977","Nepal"]];
function suggestedCallingCode(){
  try { const region=new Intl.Locale(navigator.language).region;return callingCodes.find(([country])=>country===region||(country==="US"&&region==="CA"))?.[1]||""; } catch {return "";}
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onChange: (value: string) => void };
/** The country code stays editable. No country is guessed from browser language. */
export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput({value,onChange,...props}, ref) {
  const [code,setCode]=useState(suggestedCallingCode);
  return <span className="phone-input">
    <SearchableSelect label="Country calling code" value={code} onChange={setCode} options={callingCodes.map(([,value,label])=>({value,label:`${label} ${value}`}))}/>
    <label>Other calling code (optional)<input type="tel" inputMode="tel" aria-label="Other country calling code" placeholder="+ country code" value={code} onChange={event=>setCode(event.target.value.replace(/[^\d+]/g,""))}/></label>
    <input {...props} ref={ref} type="tel" inputMode="tel" autoComplete="tel" value={value} placeholder={props.placeholder||"+ country code and number"} onChange={event=>onChange(event.target.value)} onBlur={event=>{const raw=value.trim();if(raw&&!raw.startsWith("+")&&/^\+[1-9]\d{0,3}$/.test(code))onChange(normalizePhone(`${code}${raw}`));else if(raw)onChange(normalizePhone(raw));props.onBlur?.(event);}}/>
    <small className="muted">Enter + followed by your country code and number. A local number uses the calling code above when you leave the field.</small>
  </span>;
});