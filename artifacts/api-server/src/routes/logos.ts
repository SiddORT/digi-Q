import { Router, raw } from "express";
import { randomUUID } from "node:crypto";
import { sanitizeLogo } from "../lib/logo-validation";
import { db, settings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { mediaConfig, saveLocalLogo, readLocalLogo } from "../lib/local-media";
import { z } from "zod";
import { requireUser } from "../lib/auth";
import { authorizedTemplateScope } from "../lib/notification-template-store";
import { ObjectStorageService } from "../lib/objectStorage";
import { assert } from "../lib/http";
import { audit } from "../lib/store";
import { consumeRateLimit } from "../lib/native-auth";
import { withStaffDispatch } from "../lib/staff-dispatch-barrier";

export const logosRouter = Router();
const storage = new ObjectStorageService();
const input = z.object({ name: z.string().min(1).max(200), size: z.number().int().positive().max(2 * 1024 * 1024), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), clinicId: z.string().optional() }).strict();
logosRouter.post("/management/logos", async (req, res) => {
  const user = await requireUser(req);
  const parsed = input.safeParse(req.body); assert(parsed.success, 400, "Choose a PNG, JPEG or WebP logo up to 2 MB");
  const body = parsed.data!;
  await authorizedTemplateScope(user, body.clinicId);
  await consumeRateLimit(`logo-upload:${user.id}`, 10, 900000);
  const result = await withStaffDispatch([user.id], "media", async () => {
    const id = randomUUID(), provider = mediaConfig().driver, objectId = randomUUID();
    await authorizedTemplateScope(await requireUser(req), body.clinicId);
    const data = { provider, ownerId: user.id, clinicId: body.clinicId,
      objectPath: provider === "object" ? `/objects/uploads/${objectId}` : undefined,
      plannedPath: provider === "local" ? `${objectId}.png` : undefined,
      state: "pending", expiresAt: Date.now() + 900000 };
    // Reserve exact locators before any external capability or byte write. A
    // crash leaves a discoverable pending ticket and an uncertain write barrier.
    await db.insert(settings).values({ id: `logo:${id}`, data });
    const uploadUrl = provider === "local" ? `/api/management/logos/${id}/file` : await storage.getObjectEntityUploadURL(objectId);
    await db.update(settings).set({ data: { ...data, expiresAt: Date.now() + 900000 } }).where(eq(settings.id, `logo:${id}`));
    return { id, uploadUrl };
  });
  res.json(result);
});
logosRouter.put("/management/logos/:id/file", async (req, _res, next) => {
  const user = await requireUser(req);
  const [row] = await db.select().from(settings).where(eq(settings.id, `logo:${req.params.id}`));
  const data = row?.data as any;
  assert(data?.provider === "local" && data.ownerId === user.id, 404, "Upload not found");
  await authorizedTemplateScope(user, data.clinicId);
  assert(data.expiresAt > Date.now() && data.state === "pending", 409, "Upload expired or already completed");
  next();
}, raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "2mb" }), async (req, res) => {
  const user = await requireUser(req), id = String(req.params.id);
  assert(Buffer.isBuffer(req.body), 400, "Choose a PNG, JPEG or WebP");
  const bytes = await sanitizeLogo(req.body);
  let key: string | undefined;
  try {
    await withStaffDispatch([user.id], "media", async () => {
    // Older pending local tickets did not reserve their key. Persist it in a
    // separate transaction BEFORE writing bytes, while deletion is fenced.
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`logo:${id}`}))`);
      const [row] = await tx.select().from(settings).where(eq(settings.id, `logo:${id}`));
      const data = row?.data as any;
      assert(data?.provider === "local" && data.ownerId === user.id && data.state === "pending" && data.expiresAt > Date.now(), 409, "Upload expired or already completed");
      if (!data.plannedPath) await tx.update(settings).set({ data: { ...data, plannedPath: `${randomUUID()}.png` } }).where(eq(settings.id, row.id));
    });
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`logo:${id}`}))`);
      const [row] = await tx.select().from(settings).where(eq(settings.id, `logo:${id}`));
      const data = row?.data as any;
      assert(data?.provider === "local" && data.ownerId === user.id && data.state === "pending" && data.expiresAt > Date.now(), 409, "Upload expired or already completed");
      await authorizedTemplateScope(user, data.clinicId);
      key = await saveLocalLogo(bytes!, data.plannedPath);
      await tx.update(settings).set({ data: { ...data, state: "ready", validatedPath: key } }).where(eq(settings.id, row.id));
      await audit(user, "uploadLogo", "notification_templates", { id, clinicId: data.clinicId }, tx);
    });
    });
  } catch (error) {
    // Preserve written bytes if COMMIT outcome is uncertain. An unreferenced file
    // is safer than deleting a logo that may already have committed successfully.
    throw error;
  }
  res.status(204).end();
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
  await withStaffDispatch([user.id], "media", async () => {
  await authorizedTemplateScope(await requireUser(req), data.clinicId);
  if (data.state !== "ready") {
    assert(data.provider !== "local", 409, "Upload the image before completing");
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
    await file.delete();
  }
  });
  res.json({ logoUrl: `/api/branding/logos/${id}` });
});
export const localMediaRouter = Router();
localMediaRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  assert(/^[a-f0-9-]{36}$/.test(id), 404, "Logo not found");
  const [row] = await db.select().from(settings).where(eq(settings.id, `logo:${id}`));
  const data = row?.data as any;
  assert(data?.state === "ready" && data.provider === "local", 404, "Logo not found");
  res.set({ "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" });
  res.send(await readLocalLogo(data.validatedPath));
});
logosRouter.get("/branding/logos/:id", async (req, res) => {
  const id = String(req.params.id);
  assert(/^[a-f0-9-]{36}$/.test(id), 404, "Logo not found");
  const [row] = await db.select().from(settings).where(eq(settings.id, `logo:${id}`));
  const data = row?.data as any;
  assert(data?.state === "ready", 404, "Logo not found");
  if (data.provider === "local") {
    res.redirect(302, `${mediaConfig().url}/${id}`);
    return;
  }
  const file = await storage.getObjectEntityFile(data.validatedPath);
  res.set({ "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" });
  file.createReadStream().on("error", () => res.destroy()).pipe(res);
});