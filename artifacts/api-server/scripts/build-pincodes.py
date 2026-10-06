"""Builds data/india-pincodes.json.gz from the official India Post "All India Pincode Directory"
(data.gov.in, Government Open Data License – India). Usage: python3 scripts/build-pincodes.py all_india_pin_code.csv"""
import csv, gzip, json, re, sys
def tidy(v): return " ".join(w.capitalize() if w.isupper() or w.islower() else w for w in re.split(r"\s+", (v or "").strip()))
# The directory snapshot predates later reorganisations. Normalise only splits/renames whose mapping is
# exact from official sources (no guessing):
#  - Telangana (AP Reorganisation Act 2014): India Post's Telangana circle owns every 50xxxx PIN.
#  - Ladakh (J&K Reorganisation Act 2019): Leh and Kargil districts.
#  - Dadra and Nagar Haveli and Daman and Diu (merger act 2019, effective 26 Jan 2020).
#  - Spelling: Chhattisgarh, Puducherry (official names).
RENAME = {"Chattisgarh": "Chhattisgarh", "Pondicherry": "Puducherry", "Dadra & Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
          "Daman & Diu": "Dadra and Nagar Haveli and Daman and Diu", "Andaman & Nicobar Islands": "Andaman and Nicobar Islands", "Jammu & Kashmir": "Jammu and Kashmir"}
def normalise_state(pin, district, state):
    if pin.startswith("50") and state == "Andhra Pradesh": return "Telangana"
    if state == "Jammu & Kashmir" and district in ("Leh", "Kargil"): return "Ladakh"
    return RENAME.get(state, state)
out = {}
with open(sys.argv[1], newline="", encoding="utf-8", errors="replace") as f:
    for r in csv.DictReader(f):
        pin = (r.get("pincode") or "").strip()
        if not re.fullmatch(r"[1-9]\d{5}", pin): continue
        locality = tidy(re.sub(r"\s*\b(B\.?O|S\.?O|H\.?O|G\.?P\.?O)\b\.?\s*$", "", r.get("officename") or "", flags=re.I))
        district = tidy(r.get("Districtname"))
        row = [locality, district, normalise_state(pin, district, tidy(r.get("statename")))]
        if locality and row not in out.setdefault(pin, []): out[pin].append(row)
with gzip.open("data/india-pincodes.json.gz", "wt", encoding="utf-8") as g: json.dump(out, g, separators=(",", ":"), ensure_ascii=False)
print(len(out), "pincodes")
