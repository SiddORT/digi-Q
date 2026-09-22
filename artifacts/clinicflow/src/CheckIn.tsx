import { useEffect, useRef, useState } from "react";
import { Redirect, useLocation, useSearch } from "wouter";
import { useAuth } from "@clerk/react";
import { Logo } from "./App";
import { Check, X, Camera, Image as ImageIcon, QrCode } from "lucide-react";
import * as api from "@workspace/api-client-react";
import jsQR from "jsqr";

export function CheckInScanner() {
  const { isLoaded, isSignedIn } = useAuth();
  const search = useSearch();
  const payloadFromUrl = new URLSearchParams(search).get("payload");
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), enabled: !!isSignedIn } });

  if (!isLoaded || (isSignedIn && me.isLoading)) return <div className="page-loading">Verifying access...</div>;
  if (!isSignedIn) {
    const encoded = encodeURIComponent(`/check-in${search ? `?${search}` : ""}`);
    return <Redirect to={`/sign-in?redirect=${encoded}`} />;
  }
  
  if (me.data?.user?.role === "patient") {
    return (
      <div className="landing">
        <header className="public-header"><Logo/></header>
        <main style={{ padding: "40px 20px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
          <h2>Staff Access Required</h2>
          <p>The check-in scanner is available for clinic staff only.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="landing">
      <header className="public-header"><Logo/></header>
      <main style={{ padding: "40px 20px", maxWidth: "600px", margin: "0 auto" }}>
        <section className="panel">
          <span className="eyebrow">CLINIC STAFF</span>
          <h2>Appointment Check-In</h2>
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

  useEffect(() => {
    if (payload) {
      resolve.mutate({ data: { payload } });
    }
  }, [payload]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (mode === "camera" && !payload) {
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
            videoRef.current.play();
            requestAnimationFrame(scanVideo);
          }
        })
        .catch(err => {
          console.error("Camera error:", err);
          alert(err.message || "Could not access camera. Please check permissions or use an image file.");
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
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
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
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const reset = () => {
    setPayload(null);
    resolve.reset();
    checkIn.reset();
  };

  if (payload) {
    if (resolve.isPending) return <div className="skeleton">Verifying appointment...</div>;
    if (resolve.error) return (
      <div className="error-box">
        Invalid or expired QR code.
        <button onClick={reset}>Scan again</button>
      </div>
    );
    if (resolve.data) {
      const { appointment, eligible, alreadyCheckedIn, message } = resolve.data;
      if (checkIn.isSuccess && checkIn.data) {
         return (
           <div style={{ textAlign: "center", padding: "20px 0" }}>
             <span className="confirmation-check"><Check size={34}/></span>
             <h2>{checkIn.data.alreadyCheckedIn ? "Already Checked In" : "Checked In"}</h2>
             <p>{checkIn.data.message || `${checkIn.data.appointment.patientName} has been checked in successfully.`}</p>
             <div className="confirmation-token" style={{ margin: "20px auto" }}>
               <small>TOKEN</small>
               <strong>{checkIn.data.appointment.token || "—"}</strong>
               <span>{checkIn.data.appointment.date} · {checkIn.data.appointment.status.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase())}</span>
             </div>
             <button className="button" onClick={reset}>Scan Next</button>
           </div>
         );
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
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
              disabled={checkIn.isPending} 
              onClick={() => checkIn.mutate({ data: { payload } })}
            >
              {checkIn.isPending ? "Checking in..." : "Confirm Check-in"}
            </button>
          )}
          <button className="button secondary" onClick={reset}>Cancel / Scan another</button>
        </div>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <button className={`button small ${mode === "camera" ? "" : "light"}`} onClick={() => setMode("camera")}><Camera size={16}/> Camera</button>
        <button className={`button small ${mode === "file" ? "" : "light"}`} onClick={() => setMode("file")}><ImageIcon size={16}/> Image File</button>
      </div>
      
      {mode === "camera" ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
          <video ref={videoRef} playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "60%", height: "60%", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "16px" }} />
        </div>
      ) : (
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", aspectRatio: "1", border: "2px dashed var(--color-input)", borderRadius: "12px", cursor: "pointer" }}>
          <QrCode size={48} style={{ color: "var(--color-muted-foreground)", marginBottom: "16px" }} />
          <span>Upload QR Code Image</span>
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
        </label>
      )}
    </div>
  );
}
