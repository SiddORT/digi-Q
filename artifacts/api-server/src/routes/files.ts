import { Router, raw } from "express";
import * as z from "@workspace/api-zod";
import { requireUser } from "../lib/auth";
import { assert, query } from "../lib/http";
import { consumeRateLimit } from "../lib/native-auth";
import { DOCUMENT_MAX_BYTES } from "../lib/feature-policy";
import { accessibleFile, changeFileState, fileMetadata, uploadFile, verifiedFileBytes } from "../features/files/service";
import { audit } from "../lib/store";

export const filesRouter = Router();
filesRouter.use("/files", (_req, res, next) => { res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); next(); });
filesRouter.post("/files", async (req, _res, next) => {
  await requireUser(req);
  next();
}, raw({ type: () => true, limit: DOCUMENT_MAX_BYTES }), async (req, res): Promise<void> => {
  const user = await requireUser(req), input = query(z.UploadPrivateFileQueryParams, req);
  await consumeRateLimit(`document-upload:${user.id}`, 30, 900000);
  const file = await uploadFile(user, input, req.body);
  res.status(201).json(z.UploadPrivateFileResponse.parse(fileMetadata(file)));
});
filesRouter.get("/files/:fileId", async (req, res): Promise<void> => {
  const { fileId } = z.GetPrivateFileParams.parse(req.params);
  const file = await accessibleFile(await requireUser(req), fileId, { pending: true });
  res.json(z.GetPrivateFileResponse.parse(fileMetadata(file)));
});
filesRouter.get("/files/:fileId/content", async (req, res): Promise<void> => {
  const { fileId } = z.DownloadPrivateFileParams.parse(req.params), user = await requireUser(req);
  const file = await accessibleFile(user, fileId);
  const bytes = await verifiedFileBytes(file);
  await audit(user, "downloadDocument", "patient_documents", { id: file.id, clinicId: file.clinicId });
  res.set({ "Content-Type": file.contentType, "Content-Length": String(bytes.length),
    "Content-Security-Policy": "sandbox", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}` });
  res.send(bytes);
});
filesRouter.delete("/files/:fileId", async (req, res): Promise<void> => {
  const { fileId } = z.DeletePrivateFileParams.parse(req.params);
  await changeFileState(await requireUser(req), fileId, "delete");
  res.status(204).end();
});
filesRouter.post("/files/:fileId/restore", async (req, res): Promise<void> => {
  const { fileId } = z.RestorePrivateFileParams.parse(req.params);
  res.json(z.RestorePrivateFileResponse.parse(fileMetadata(await changeFileState(await requireUser(req), fileId, "restore"))));
});
filesRouter.post("/files/:fileId/approve", async (req, res): Promise<void> => {
  const { fileId } = z.ApprovePrivateFileParams.parse(req.params);
  const input = z.ApprovePrivateFileBody.parse(req.body);
  assert(input.reviewed === true, 400, "Confirm the offline security review");
  res.json(z.ApprovePrivateFileResponse.parse(fileMetadata(await changeFileState(await requireUser(req), fileId, "approve", input.digest))));
});
