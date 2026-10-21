import type { Request, Response } from "express";
import { GetPublicWebsiteConfigResponse } from "@workspace/api-zod";
import { publicOrigin } from "./public-website";

export function publicWebsiteConfig(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetPublicWebsiteConfigResponse.parse({ publicOrigin: publicOrigin() }));
}
