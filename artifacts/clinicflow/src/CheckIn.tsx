import { usePublicWebsite, PublicWebsiteStatus } from "./lib/public-website";
import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useSearch } from "wouter";
import { staffQrPayload } from "./lib/staff-qr";
import { closeQrInline, qrReturnFocus, useQrInline } from "./lib/qr-inline";
import { AppDialog } from "./components/AppDialog";
import { errorStatus, friendlyError } from "./lib/friendly-error";
import { useNativeAuth } from "./auth/native-auth";
import { Logo } from "./App";
import { Check, Camera, Image as ImageIcon, QrCode } from "lucide-react";
import * as api from "@workspace/api-client-react";
import jsQR from "jsqr";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorNotice } from "./resources";
import { useFreshWorkspace } from "./components/queue/useFreshWorkspace";
import { formatDate } from "./lib/date-time";
import { formatSessionHours } from "./components/queue/SessionSelector";

export function CheckInScanner() {
   const { isLoaded, isSignedIn } = useNativeAuth();
  const search = useSearch();
  const payloadFromUrl = new URLSearchParams(search).get("payload");
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), enabled: !!isSignedIn } });

  if (!isLoaded || (isSignedIn && me.isLoading)) return <div className="page-loading">Verifying access…</div>;
  if (!isSignedIn) {
    const encoded = encodeURIComponent(`/check-in${search ? `?${search}` : ""}`);
    return <Redirect to={`/sign-in?redirect=${encoded}`} />;
  }
  if (me.error || !me.data?.user) {
    return <main className="public-book"><h2>We couldn’t check your access</h2><ErrorNotice error={me.error} onRetry={()=>me.refetch()} busy={me.isFetching}/></main>;
  }
  
  if (!["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(me.data.user.role)) {
    return (
      <div className="landing">
        <header className="public-header"><Logo/></header>
        <main style={{ padding: "40px 24px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <h2>Staff Access Required</h2>
          <p>The check-in scanner is available for clinic staff only.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="landing">
      <header className="public-header"><Logo/></header>
      <main className="qr-standalone">
        <section className="panel padded">
          <span className="eyebrow">Clinic Staff</span>
           <h2>Validate Appointment QR</h2>
           <p>Scanning only verifies the ticket. Confirm check-in explicitly when the patient enters consultation.</p>
          <ScannerCore initialPayload={payloadFromUrl} />
          <p className="qr-standalone-return"><Link href="/" className="button secondary small" data-testid="link-check-in-return">Back to Workspace</Link></p>
        </section>
      </main>
    </div>
  );
}

/** One modal host for all existing workspace QR validation actions. */
export function QrInlineHost() {
  const open = useQrInline();
  return <QrValidationDialog open={open} onClose={closeQrInline} />;
}

export function QrValidationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return <AppDialog open={open} onClose={onClose} busy={busy} returnFocusElement={qrReturnFocus()}
    title="Validate Appointment QR" description="Scanning only verifies the ticket. Confirm check-in explicitly when the patient enters consultation.">
    {open && <div className="qr-validator" data-testid="panel-qr-validation"><ScannerCore initialPayload={null} onBusyChange={setBusy}/></div>}
  </AppDialog>;
}

export function ScannerCore({ initialPayload, onBusyChange }: { initialPayload: string | null; onBusyChange?: (busy: boolean) => void }) {
  const site = usePublicWebsite();
  const [pasted, setPasted] = useState("");
  const [payload, setPayload] = useState<string | null>(initialPayload);
  const [scanError, setScanError] = useState<string | null>(null);
  const resolve = api.useResolveAppointmentQr();
  const checkIn = api.useCheckInAppointmentQr();
  const [mode, setMode] = useState<"camera" | "file" | "paste">("camera");
  const [uploading, setUploading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inputGeneration = useRef(0);
  const imageCleanup = useRef<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submitting = useRef(false);
  const generation = useRef(0);
  const [resolved, setResolved] = useState<api.AppointmentQrResolution | null>(null);
  const [resolveError, setResolveError] = useState<unknown>(null);
  const client = useQueryClient();
  const [verifiedAt,setVerifiedAt]=useState(0);
  const freshness=useFreshWorkspace(verifiedAt);
  useEffect(() => { setPayload(initialPayload); }, [initialPayload]);
  useEffect(() => { onBusyChange?.(checkIn.isPending); }, [checkIn.isPending, onBusyChange]);
  useEffect(() => () => {
    inputGeneration.current++;
    imageCleanup.current?.();
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    setResolved(null);
    setResolveError(null);
    if (payload) {
      void resolve.mutateAsync({ data: { payload } }).then(value => {
        if (current === generation.current) {setResolved(value);setVerifiedAt(Date.now());}
      }).catch(error => {
        if (current === generation.current) setResolveError(error);
      });
    }
    return () => { generation.current++; };
  }, [payload, attempt]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (mode === "camera" && !payload) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError("Camera access is unavailable in this browser. Upload a QR image instead.");
        setMode("file");
        return;
      }
      let active = true;
      let frame = 0;
      let detector: any = null;
      try {
        if ("BarcodeDetector" in window) detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      } catch { /* Unsupported native format: use jsQR. */ }
      const schedule = () => { if (active) frame = requestAnimationFrame(scanVideo); };
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          if (!active) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().then(() => {
              schedule();
            }).catch(() => {
              if (active) {
                setScanError("Unable to start the camera. Upload a QR image instead.");
                setMode("file");
              }
            });
          }
        })
        .catch(err => {
          if (!active) return;
          setScanError("Could not access the camera. Check camera permissions or upload a QR image.");
          setMode("file");
        });
        
      const scanVideo = () => {
        if (!active || !videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
          schedule();
          return;
        }
        
        // Native BarcodeDetector (if available in modern browsers)
        if (detector) {
          Promise.resolve().then(() => active ? detector.detect(videoRef.current) : []).then((barcodes: any) => {
            if (!active) return;
            if (barcodes.length > 0) {
              if (!handleScanResult(barcodes[0].rawValue)) schedule();
            } else if (active) {
              schedule();
            }
          }).catch(() => { if (active) { detector = null; fallbackJsqr(); } });
        } else {
          fallbackJsqr();
        }
      };

      const fallbackJsqr = () => {
        const video = videoRef.current;
        if (!video || !active) return;
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1000 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        try { if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
              if (handleScanResult(code.data)) return;
          }
        } } catch {
          if (active) { setScanError("Unable to read the camera preview. Try an image or pasted code."); setMode("file"); }
          return;
        }
        schedule();
      };

      return () => {
        active = false;
        cancelAnimationFrame(frame);
        stopCamera();
        if (videoRef.current) videoRef.current.srcObject = null;
      };
    } else {
      stopCamera();
      return undefined;
    }
  }, [mode, payload, site.origin]);

  const handleScanResult = (result: string) => {
    const parsed = staffQrPayload(result, window.location.origin, import.meta.env.BASE_URL, site.origin);
    if ("error" in parsed) { setScanError(parsed.error); return false; }
    setScanError(null);
    setPayload(parsed.payload);
    return true;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    imageCleanup.current?.();
    const current = ++inputGeneration.current;
    setUploading(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      setScanError("Choose a QR image smaller than 10 MB.");
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    setUploading(true);
    imageCleanup.current = () => { img.onload = null; img.onerror = null; URL.revokeObjectURL(objectUrl); };
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (current !== inputGeneration.current) return;
      setUploading(false);
      try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          handleScanResult(code.data);
        } else {
          setScanError("No QR code found in image. Please try a clearer image.");
        }
      } else {
        setScanError("Unable to read this image. Please try a different image.");
      }
      } catch { setScanError("Unable to read this image. Please try a different image."); }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (current !== inputGeneration.current) return;
      setUploading(false);
      setScanError("This image could not be opened. Choose a valid PNG, JPEG or WebP image.");
    };
    img.src = objectUrl;
  };

  const reset = () => {
    if (submitting.current) return;
    generation.current++;
    inputGeneration.current++;
    imageCleanup.current?.();
    setUploading(false);
    setResolved(null);
    setResolveError(null);
    setPayload(null);
    setScanError(null);
    resolve.reset();
    checkIn.reset();
  };
  const changeMode = (next: typeof mode) => {
    inputGeneration.current++;
    imageCleanup.current?.();
    setUploading(false);
    setScanError(null);
    setMode(next);
  };

  if (payload) {
    if (!resolved && !resolveError) return <div className="qr-progress" role="status">Verifying appointment…</div>;
    if (resolveError) return (
       <div className="error-box" role="alert">
        <h3>QR not verified</h3>
        <p>{qrVerificationError(resolveError)}</p>
        <div className="qr-actions"><button type="button" className="button small" onClick={() => { setResolved(null); setResolveError(null); setAttempt(a => a + 1); }}>Retry verification</button>
        {errorStatus(resolveError) === 401 && <Link className="button small" href={`/sign-in?redirect=${encodeURIComponent(`/check-in?payload=${encodeURIComponent(payload)}`)}`}>Staff Login</Link>}
        <button type="button" className="button secondary small" onClick={reset} data-testid="button-qr-scan-another">Scan Another</button></div>
      </div>
    );
    if (resolved) {
      const { appointment, eligible, alreadyCheckedIn, message } = resolved;
      if (checkIn.isSuccess && checkIn.data) {
         return (
            <div role="status" style={{ textAlign: "center", padding: "24px 0" }}>
             <span className="confirmation-check"><Check size={34}/></span>
              <h2>{checkIn.data.alreadyCheckedIn ? "Already checked in" : "Checked in"}</h2>
             <p>{checkIn.data.message || `${checkIn.data.appointment.patientName} has been checked in successfully.`}</p>
             <div className="confirmation-token" style={{ margin: "24px auto" }}>
               <small>TOKEN</small>
               <strong>{checkIn.data.appointment.token || "—"}</strong>
               <span>{formatDate(checkIn.data.appointment.date,checkIn.data.appointment)} · {formatSessionHours(checkIn.data.appointment)} · {checkIn.data.appointment.status.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase())}</span>
             </div>
               <button className="button" onClick={reset} data-testid="button-qr-scan-another">Scan Another</button>
           </div>
         );
      }
      return (
        <div className="qr-result">
          <div className={eligible ? "notice qr-outcome" : "qr-outcome"} role="status">
            <h3>{eligible ? <><Check size={20} aria-hidden/> QR verified</> : "Ticket recognized — check-in unavailable"}</h3>
            <p>{alreadyCheckedIn ? "Consultation has already started. No new check-in is needed." : message}</p>
          </div>
           {checkIn.error && <><ErrorNotice error={checkIn.error}/><p>Check-in was not confirmed. Retry safely; an existing check-in will not be duplicated.</p></>}
          <div>
            {freshness.stale&&<p role="alert">Verification is stale or you are offline. Scan again after reconnecting before checking in.</p>}
            <small>Patient</small>
            <h3>{appointment.patientName}</h3>
            <p>{appointment.doctorName} · {appointment.branchName}</p>
             <p>Token {appointment.token || "—"} · {formatDate(appointment.date, appointment)} · {formatSessionHours(appointment)}</p>
          </div>
          {alreadyCheckedIn ? (
            <div className="notice">This appointment is already checked in.</div>
          ) : !eligible ? (
            <div className="error-box">{message || "This appointment cannot be checked in at this time."}</div>
          ) : (
            <button 
              className="button" 
              disabled={checkIn.isPending||freshness.stale}
              onClick={() => {
                if (submitting.current || checkIn.isPending || freshness.stale) return;
                submitting.current = true;
                 onBusyChange?.(true);
                checkIn.mutate({ data: { payload } }, {
                  onSuccess: () => { client.invalidateQueries(); },
                  onSettled: () => { submitting.current = false; onBusyChange?.(false); },
                });
              }}
            >
              {checkIn.isPending ? "Checking in…" : "Check In — Enter Consultation"}
            </button>
          )}
          <button className="button secondary" disabled={checkIn.isPending} onClick={reset} data-testid="button-qr-scan-another">Scan Another</button>
        </div>
      );
    }
  }

  return (
    <div className="qr-inputs">
      <PublicWebsiteStatus/>
      {scanError && <div className="error-box" role="alert">{scanError}</div>}
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <button type="button" aria-pressed={mode === "camera"} className={`button small ${mode === "camera" ? "" : "light"}`} onClick={() => changeMode("camera")} data-testid="button-scan-camera"><Camera size={16}/> Camera</button>
        <button type="button" aria-pressed={mode === "file"} className={`button small ${mode === "file" ? "" : "light"}`} onClick={() => changeMode("file")} data-testid="button-scan-file"><ImageIcon size={16}/> Image File</button>
        <button type="button" aria-pressed={mode === "paste"} className={`button small ${mode === "paste" ? "" : "light"}`} onClick={() => changeMode("paste")} data-testid="button-scan-paste">Paste Code</button>
      </div>
      
      {mode === "paste" ? (
        <form onSubmit={e => { e.preventDefault(); const value = pasted.trim(); if (!value) { setScanError("Paste the appointment QR text or link first."); return; } setPasted(""); handleScanResult(value); }} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label>QR text or check-in link<textarea value={pasted} onChange={e => setPasted(e.target.value)} rows={3} data-testid="input-qr-paste"/></label>
          <button type="submit" className="button small" data-testid="button-qr-paste-validate">Validate</button>
        </form>
      ) : mode === "camera" ? (
        <div className="qr-camera">
          <video ref={videoRef} playsInline aria-label="Camera preview for scanning the appointment QR code" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "60%", height: "60%", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "16px" }} />
        </div>
      ) : (
        <label className="qr-upload" aria-busy={uploading}>
          <QrCode size={32} aria-hidden/>
          <span>Upload QR code image</span>
          <input type="file" accept="image/*" onChange={handleFileUpload} />
          {uploading && <span role="status">Reading QR image…</span>}
        </label>
      )}
    </div>
  );
}

function qrVerificationError(error: unknown) {
  switch (errorStatus(error)) {
    case 400: return "This appointment QR is invalid or has been altered. Use the original ticket or ask reception for help.";
    case 401: return "Your session has expired. Sign in as staff to verify this ticket.";
    case 403: return "You do not have staff access to this appointment. Ask staff assigned to its clinic and location.";
    case 404: return "No appointment was found for this ticket. Ask reception to confirm the booking.";
    case 409: return friendlyError(error, "load") + " No check-in was made.";
    default: return friendlyError(error, "load", "We couldn’t verify this ticket. Check your connection and retry. No check-in was made.");
  }
}
