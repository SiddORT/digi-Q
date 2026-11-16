import { db, patientDocuments } from "@workspace/db";
import { eq } from "drizzle-orm";

/** One registry, retaining the historical table name and document IDs. No
 * second copy of provider, locator, metadata or lifecycle is introduced. */
export const fileRegistry = patientDocuments;
export type PrivateFile = typeof patientDocuments.$inferSelect;
export async function findFile(id: string, conn: any = db): Promise<PrivateFile | undefined> {
  const [file] = await conn.select().from(fileRegistry).where(eq(fileRegistry.id, id));
  return file;
}
