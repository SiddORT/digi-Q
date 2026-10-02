import { Router } from "express";
import { randomUUID } from "node:crypto";
import { sanitizeLogo } from "../lib/logo-validation";
import { db, settings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../lib/auth";
import { authorizedTemplateScope } from "../lib/notification-template-store";
import { ObjectStorageService } from "../lib/objectStorage";
import { assert } from "../lib/http";
import { audit } from "../lib/store";
import { consumeRateLimit } from "../lib/native-auth";

export const logosRouter = Router();
const storage = new ObjectStorageService();
const input = z.object({ name: z.string().min(1).max(200), size: z.number().int().positive().max(2 * 1024 * 1024), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), clinicId: z.string().optional() }).strict();
logosRouter.post("/management/logos", async (req, res) => {
  const user = await requireUser(req);
  const parsed = input.safeParse(req.body); assert(parsed.success, 400, "Choose a PNG, JPEG or WebP logo up to 2 MB");
  const body = parsed.data!;
  await authorizedTemplateScope(user, body.clinicId);
  await consumeRateLimit(`logo-upload:${user.id}`, 10, 900000);
  const uploadUrl = await storage.getObjectEntityUploadURL(), id = randomUUID();
  await db.insert(settings).values({ id: `logo:${id}`, data: { ownerId: user.id, clinicId: body.clinicId, objectPath: storage.normalizeObjectEntityPath(uploadUrl), state: "pending", expiresAt: Date.now() + 900000 } });
  res.json({ id, uploadUrl });
});
logosRouter.post("/management/logos/:id/complete", async (req, res) => {
  const user = await requireUser(req);
  const id = String(req.params.id);
  assert(/^[a-f0-9-]{36}$/.test(id), 400, "Invalid upload");
  const [row] = await db.select().from(settings).where(eq(settings.id, `logo:${id}`));
  const data = row?.data as any;
  assert(data && data.ownerId === user.id, 404, "Upload not found");
  await authorizedTemplateScope(user, data.clinicId);
  assert(data.state === "ready" || data.expiresAt > Date.now(), 410, "Upload expired; select the file again");
  if (data.state !== "ready") {
    const file = await storage.getObjectEntityFile(data.objectPath);
    const [meta] = await file.getMetadata();
    assert(Number(meta.size) > 0 && Number(meta.size) <= 2097152, 400, "Logo must be at most 2 MB");
    const chunks: Buffer[] = [];
    let total = 0;
    const stream = file.createReadStream();
    for await (const chunk of stream) {
      total += chunk.length;
      if (total > 2097152) { stream.destroy(); assert(false, 400, "Logo must be at most 2 MB"); }
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    const safe = await sanitizeLogo(bytes);
    // Copy sanitized bytes to a different object: the original signed PUT cannot replace a published logo.
    const publicFile = file.bucket.file(`${file.name}-validated.png`);
    await publicFile.save(safe!, { resumable: false, contentType: "image/png" });
    await db.transaction(async tx => {
      await tx.update(settings).set({ data: { ...data, state: "ready", validatedPath: `${data.objectPath}-validated.png` } }).where(eq(settings.id, row.id));
      await audit(user, "uploadLogo", "notification_templates", { id, clinicId: data.clinicId }, tx);
    });
    await file.delete().catch(() => undefined);
  }
  res.json({ logoUrl: `/api/branding/logos/${id}` });
});
logosRouter.get("/branding/logos/:id", async (req, res) => {
  const id = String(req.params.id);
  assert(/^[a-f0-9-]{36}$/.test(id), 404, "Logo not found");
  const [row] = await db.select().from(settings).where(eq(settings.id, `logo:${id}`));
  const data = row?.data as any;
  assert(data?.state === "ready", 404, "Logo not found");
  const file = await storage.getObjectEntityFile(data.validatedPath);
  res.set({ "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" });
  file.createReadStream().on("error", () => res.destroy()).pipe(res);
});