import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import * as api from "@/lib/api";
import { formatConfiguredTimestamp } from "@/lib/date-time";
import { OverflowText } from "./OverflowText";
import { SearchableSelect } from "./SearchableSelect";
import { CapabilityView, fromQuery } from "./CapabilityState";

const MAX = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain";
const size = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

/** Private patient documents. Bytes are only reachable through the authorized download endpoint. */
export function PatientDocuments({ patientId, timezone }: { patientId: string; timezone?: string }) {
  const client = useQueryClient();
  const key = api.getListPatientDocumentsQueryKey(patientId);
  const q = api.useListPatientDocuments(patientId, { query: { queryKey: key } });
  const [clinicId, setClinicId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<api.PatientDocument | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const uploadClinics = q.data?.uploadClinicIds ?? [];
  const value = fromQuery(q, { isEmpty: d => !d.items.length, emptyMessage: "No documents have been uploaded for this patient in your clinics.", errorMessage: "Documents could not be loaded.", forbiddenReason: "Your role can't view this patient's documents." });

  async function upload(f: File) {
    setError(""); setMessage("");
    if (f.size > MAX) { setError("Files must be 10 MB or smaller."); return; }
    setBusy("upload");
    try {
      // The File is sent as-is (generated client sets application/octet-stream); the server sniffs magic bytes.
      await api.uploadPatientDocument(patientId, f, { name: f.name.slice(0, 160), clinicId: clinicId || uploadClinics[0] });
      setMessage(`"${f.name}" uploaded.`); await refresh();
    } catch (e) { setError((e as { data?: { error?: string } })?.data?.error || "Upload failed. Use a PDF, PNG, JPEG, WebP or plain text file."); }
    finally { setBusy(null); if (file.current) file.current.value = ""; }
  }
  async function download(d: api.PatientDocument) {
    setError(""); setBusy(d.id);
    try {
      // customFetch supports responseType "blob"; the generated client already types this as Promise<Blob>.
      const blob = await api.downloadPatientDocument(d.id, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = d.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { setError("Download failed or the document is no longer available."); }
    finally { setBusy(null); }
  }
  async function remove(d: api.PatientDocument) {
    setError(""); setBusy(d.id);
    try { await api.deletePatientDocument(d.id); setMessage(`"${d.name}" deleted.`); setConfirm(null); await refresh(); }
    catch (e) { setError((e as { data?: { error?: string } })?.data?.error || "Delete failed."); }
    finally { setBusy(null); }
  }
  return <>
    {uploadClinics.length > 0 && <div className="pd-doc-actions">
      {uploadClinics.length > 1 && <SearchableSelect label="Clinic" testId="select-document-clinic" value={clinicId || uploadClinics[0]} onChange={v => { if (v) setClinicId(v); }} options={uploadClinics.map(c => ({ value: c, label: q.data?.items.find(i => i.clinicId === c)?.clinicName || `Clinic ${c.slice(0, 6)}` }))} />}
      <input ref={file} id={fileId} type="file" accept={ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} data-testid="input-document-file" />
      <button type="button" className="button small" disabled={busy === "upload"} onClick={() => file.current?.click()} data-testid="button-upload-document"><Upload size={15} aria-hidden />{busy === "upload" ? "Uploading…" : "Upload Document"}</button>
      <small className="muted">PDF, PNG, JPEG, WebP or text · up to 10 MB · stored privately.</small>
    </div>}
    <small role="status" aria-live="polite">{message}</small>
    {error && <p role="alert" className="field-error">{error}</p>}
    <CapabilityView value={value} title="Documents" testId="patient-documents">{d => <ul className="pd-timeline">{d.items.map(doc => <li key={doc.id}>
      <span className="pd-dot" aria-hidden><FileText size={14} /></span>
      <div className="pd-item"><div className="pd-row"><OverflowText as="strong" value={doc.name} /><small className="muted">{size(doc.size)}</small></div>
        <small className="muted">{formatConfiguredTimestamp(doc.createdAt, timezone)}{doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}{doc.clinicName ? ` · ${doc.clinicName}` : ""}</small>
        <div className="pd-doc-actions">
          <button type="button" className="button secondary small" disabled={busy === doc.id} onClick={() => void download(doc)} data-testid={`button-download-document-${doc.id}`}><Download size={15} aria-hidden />Download</button>
          {confirm?.id === doc.id
            ? <><button type="button" className="button small danger" disabled={busy === doc.id} onClick={() => void remove(doc)} data-testid={`button-confirm-delete-document-${doc.id}`}>Confirm Delete</button><button type="button" className="button secondary small" onClick={() => setConfirm(null)}>Keep</button></>
            : <button type="button" className="button secondary small" onClick={() => setConfirm(doc)} aria-label={`Delete ${doc.name}`} data-testid={`button-delete-document-${doc.id}`}><Trash2 size={15} aria-hidden />Delete</button>}
        </div></div>
    </li>)}</ul>}</CapabilityView>
  </>;
}
