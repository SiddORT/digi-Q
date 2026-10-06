import { Router } from "express";
import { requireUser } from "../lib/auth";
import { cityCompatible, searchGeographicNames } from "../lib/geography";
import { lookupPincode, PINCODE_ATTRIBUTION } from "../lib/pincode";
import { assert } from "../lib/http";
import { publicReferenceLimit } from "../lib/public-limit";
export const geographyRouter = Router();
const text = (value: unknown, name: string) => { const v = value ?? ""; assert(typeof v === "string" && v.length <= 100, 400, `${name} must be at most 100 characters`); return v as string; };
function directory(query: any) {
  const kind = query.kind;
  assert(kind === "country" || kind === "state" || kind === "city", 400, "Choose country, state or city");
  const search = text(query.search, "Search"), country = text(query.country, "Country"), state = text(query.state, "State"), city = text(query.city, "City");
  const items = searchGeographicNames(kind as "country" | "state" | "city", search, { country, state });
  return kind === "city" && city ? { items, compatible: cityCompatible(city, { country, state }) } : { items };
}
geographyRouter.get("/geography", async (req, res) => { await requireUser(req); res.json(directory(req.query)); });
// Public, read-only, bounded (20 names / 50 localities) and rate-limited: used by registration and guest screens.
geographyRouter.get("/public/geography", (req, res) => { publicReferenceLimit(`geo:${req.ip}`); res.set("Cache-Control", "public, max-age=3600"); res.json(directory(req.query)); });
geographyRouter.get("/public/pincode/:pin", (req, res) => {
  publicReferenceLimit(`geo:${req.ip}`);
  const pin = String(req.params.pin || "").replace(/\s/g, "");
  assert(/^[1-9]\d{5}$/.test(pin), 400, "Enter a 6-digit PIN code");
  const items = lookupPincode(pin);
  res.set("Cache-Control", "public, max-age=86400");
  res.json({ pincode: pin, available: items !== null, items: items || [], attribution: PINCODE_ATTRIBUTION });
});
