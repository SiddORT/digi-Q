import { Router } from "express";
import { requireUser } from "../lib/auth";
import { searchGeographicNames } from "../lib/geography";
import { assert } from "../lib/http";
export const geographyRouter = Router();
geographyRouter.get("/geography", async(req,res)=>{
  await requireUser(req);
  const kind=req.query.kind, search=req.query.search ?? "";
  assert(kind==="country"||kind==="state"||kind==="city",400,"Choose country, state or city");
  assert(typeof search==="string"&&search.length<=100,400,"Search must be at most 100 characters");
  res.json({items:searchGeographicNames(kind as "country"|"state"|"city",search as string)});
});
