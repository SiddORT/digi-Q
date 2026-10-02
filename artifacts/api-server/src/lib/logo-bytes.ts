import { db, settings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { assert } from "./http";
export async function loadLogoBytes(path: string) {
  assert(/^\/api\/branding\/logos\/[a-f0-9-]{36}$/.test(path), 400, "Invalid logo");
  const [row] = await db.select().from(settings).where(eq(settings.id, `logo:${path.split("/").at(-1)}`));
  const data = row?.data as any;
  assert(data?.state === "ready", 400, "Logo is unavailable");
  const file = await new ObjectStorageService().getObjectEntityFile(data.validatedPath);
  const [bytes] = await file.download();
  return bytes;
}