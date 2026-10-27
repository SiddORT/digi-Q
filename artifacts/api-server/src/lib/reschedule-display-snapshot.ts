import { branches, doctors, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { flatten } from "./store";

const label = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;

/** Capture today's labels only for a new move, never to reconstruct an older event.
 * Keep doctorId alongside doctorName so the existing staff eraser can remove it. */
export async function rescheduleDisplaySnapshot(doctorId: string, branchId: string, conn: any) {
  const [storedDoctor] = await conn.select().from(doctors).where(eq(doctors.id, doctorId));
  const doctor = flatten(storedDoctor);
  const [storedBranch] = await conn.select().from(branches).where(eq(branches.id, branchId));
  const branch = flatten(storedBranch);
  const deletedDoctor = doctor?.deletedDoctor || doctor?.status === "retired";
  const [account] = !deletedDoctor && doctor?.userId
    ? await conn.select({ fullName: users.fullName }).from(users).where(eq(users.id, doctor.userId)) : [];
  return {
    ...(deletedDoctor ? { deletedDoctor: true } : label(account?.fullName) ? { doctorName: label(account.fullName) } : {}),
    ...(label(branch?.name) ? { branchName: label(branch.name) } : {}),
  };
}

/** Shared list/write/receipt views retain their pre-snapshot history contract. */
export function withoutRescheduleDisplaySnapshots(history: any[]) {
  const coordinates = (value: any) => {
    if (!value || typeof value !== "object") return value;
    const { doctorName, branchName, deletedDoctor, ...rest } = value;
    return rest;
  };
  return history.map(event => ({
    ...event,
    ...(event.from ? { from: coordinates(event.from) } : {}),
    ...(event.to ? { to: coordinates(event.to) } : {}),
  }));
}
