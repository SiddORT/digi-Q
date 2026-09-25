import { db, settings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sessionKey } from "./session-duration";

export async function getPresence(session: any, conn: any = db) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "presence:" + sessionKey(session)));
  return { doctorId: session.doctorId, branchId: session.branchId, date: session.date,
    ...(session.sessionId ? { sessionId: session.sessionId } : {}), ...(session.startTime ? { startTime: session.startTime } : {}),
    status: row?.data?.status || "available", updatedAt: row?.data?.updatedAt || null };
}
export async function isDoctorAvailable(session: any, conn: any = db) {
  return (await getPresence(session, conn)).status === "available";
}