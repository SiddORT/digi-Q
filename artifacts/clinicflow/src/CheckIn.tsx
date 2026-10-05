import { useEffect, useRef, useState } from "react";
import { Redirect, useSearch } from "wouter";
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
    return <main className="public-book"><div className="error-box" role="alert"><h2>Unable to verify staff access</h2><p>Please retry before scanning an appointment.</p><button className="button secondary" onClick={() => me.refetch()}>Retry</button></div></main>;
  }
  
  if (me.data?.user?.role === "patient") {
    return (
      <div className="landing">
        <header className="public-header"><Logo/></header>
        <main style={{ padding: "40px 24px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <h2>Staff access required</h2>
          <p>The check-in scanner is available for clinic staff only.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="landing">
      <header className="public-header"><Logo/></header>
      <main style={{ padding: "40px 24px", maxWidth: "600px", margin: "0 auto" }}>
        <section className="panel padded">
          <span className="eyebrow">CLINIC STAFF</span>
           <h2>Validate appointment QR</h2>
           <p>Scanning only verifies the ticket. Confirm check-in explicitly when the patient enters consultation.</p>
          <ScannerCore initialPayload={payloadFromUrl} />
        </section>
      </main>
    </div>
  );
}

function ScannerCore({ initialPayload }: { initialPayload: string | null }) {
  const [payload, setPayload] = useState<string | null>(initialPayload);
  const [scanError, setScanError] = useState<string | null>(null);
  const resolve = api.useResolveAppointmentQr();
  const checkIn = api.useCheckInAppointmentQr();
  const [mode, setMode] = useState<"camera" | "file">("camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submitting = useRef(false);
  const generation = useRef(0);
  const [resolved, setResolved] = useState<api.AppointmentQrResolution | null>(null);
  const [resolveError, setResolveError] = useState<unknown>(null);
  const client = useQueryClient();
  const [verifiedAt,setVerifiedAt]=useState(0);
  const freshness=useFreshWorkspace(verifiedAt);

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
  }, [payload]);

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
              if (active) requestAnimationFrame(scanVideo);
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
          if (active) requestAnimationFrame(scanVideo);
          return;
        }
        
        // Native BarcodeDetector (if available in modern browsers)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          detector.detect(videoRef.current).then((barcodes: any) => {
            if (!active) return;
            if (barcodes.length > 0) {
              handleScanResult(barcodes[0].rawValue);
            } else if (active) {
              requestAnimationFrame(scanVideo);
            }
          }).catch(() => fallbackJsqr(active));
        } else {
          fallbackJsqr(active);
        }
      };

      const fallbackJsqr = (isActive: boolean) => {
        const video = videoRef.current;
        if (!video || !isActive) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            handleScanResult(code.data);
            return;
          }
        }
        requestAnimationFrame(scanVideo);
      };

      return () => {
        active = false;
        stopCamera();
      };
    } else {
      stopCamera();
      return undefined;
    }
  }, [mode, payload]);

  const handleScanResult = (result: string) => {
    try {
      const url = new URL(result);
      if (url.searchParams.has("payload")) {
        setPayload(url.searchParams.get("payload"));
      } else {
        setPayload(result);
      }
    } catch {
      setPayload(result);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError(null);
    const current = generation.current;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      setScanError("Choose a QR image smaller than 10 MB.");
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (current !== generation.current) return;
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
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (current !== generation.current) return;
      setScanError("This image could not be opened. Choose a valid PNG, JPEG or WebP image.");
    };
    img.src = objectUrl;
  };

  const reset = () => {
    if (submitting.current) return;
    generation.current++;
    setResolved(null);
    setResolveError(null);
    setPayload(null);
    setScanError(null);
    resolve.reset();
    checkIn.reset();
  };

  if (payload) {
    if (!resolved && !resolveError) return <div className="skeleton">Verifying appointment…</div>;
    if (resolveError) return (
       <div className="error-box" role="alert">
        <ErrorNotice error={resolveError}/>
        <button onClick={reset}>Scan again</button>
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
              <button className="button" onClick={reset}>Scan next</button>
           </div>
         );
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
           {checkIn.error && <><ErrorNotice error={checkIn.error}/><p>Check-in was not confirmed. Retry safely; an existing check-in will not be duplicated.</p></>}
          <div>
            {freshness.stale&&<p role="alert">Verification is stale or you are offline. Scan again after reconnecting before checking in.</p>}
            <small>PATIENT</small>
            <h3>{appointment.patientName}</h3>
            <p>{appointment.doctorName} · {appointment.branchName}</p>
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
                checkIn.mutate({ data: { payload } }, {
                  onSuccess: () => { client.invalidateQueries(); },
                  onSettled: () => { submitting.current = false; },
                });
              }}
            >
              {checkIn.isPending ? "Checking in…" : "Check in — enter consultation"}
            </button>
          )}
          <button className="button secondary" disabled={checkIn.isPending} onClick={reset}>Cancel / Scan another</button>
        </div>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {scanError && <div className="error-box" role="alert">{scanError}</div>}
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <button className={`button small ${mode === "camera" ? "" : "light"}`} onClick={() => setMode("camera")}><Camera size={16}/> Camera</button>
        <button className={`button small ${mode === "file" ? "" : "light"}`} onClick={() => setMode("file")}><ImageIcon size={16}/> Image file</button>
      </div>
      
      {mode === "camera" ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
          <video ref={videoRef} playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "60%", height: "60%", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "16px" }} />
        </div>
      ) : (
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", aspectRatio: "1", border: "2px dashed var(--color-input)", borderRadius: "12px", cursor: "pointer" }}>
          <QrCode size={48} style={{ color: "var(--color-muted-foreground)", marginBottom: "16px" }} />
          <span>Upload QR code image</span>
          <input type="file" accept="image/*" onChange={handleFileUpload} />
        </label>
      )}
    </div>
  );
}
