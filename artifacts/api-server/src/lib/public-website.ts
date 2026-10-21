import { parsePublicOrigin, publicWebsiteUrl } from "@workspace/api-zod/public-website";
import { HttpError } from "./http";

export function publicOrigin(): string {
  const origin = parsePublicOrigin(process.env.CLINICFLOW_PUBLIC_ORIGIN);
  if (!origin) throw new HttpError(503, "Public website links are not configured", "PUBLIC_ORIGIN_UNCONFIGURED");
  return origin;
}
export function publicUrl(route: string): string {
  return publicWebsiteUrl(publicOrigin(), route);
}
