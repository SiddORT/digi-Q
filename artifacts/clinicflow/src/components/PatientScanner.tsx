import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Camera, Image as ImageIcon } from "lucide-react";
import jsQR from "jsqr";
import { Logo } from "../App";
import { BRAND_NAME } from "../branding";
import { patientBookingPath } from "./patient-qr";

export function PatientScanner() {
  const [, navigate] = useLocation();
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const completed = useRef(false);

  function openBooking(value: string) {
    const path = patientBookingPath(value, window.location.origin, import.meta.env.BASE_URL);
    if (!path) {
      setError(`This is not a ${BRAND_NAME} booking QR code for this website. Scan the clinic's booking QR, or choose Guest booking below. Appointment check-in codes are for staff only.`);
      completed.current = false;
      setScanning(false);
      return;
    }
    completed.current = true;
    setScanning(false);
    navigate(path);
  }

  useEffect(() => {
    if (!scanning) return;
    let active = true;
    let stream: MediaStream | null = null;
    let frame = 0;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Use your phone's camera app to open the clinic QR link, or upload a QR image below.");
      setScanning(false);
      return;
    }
    const scan = () => {
      if (!active || completed.current) return;
      const element = video.current;
      if (element && element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && element.videoWidth) {
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext("2d", {willReadFrequently:true});
        if (context) {
          context.drawImage(element, 0, 0);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(image.data, image.width, image.height);
          if (qr) { completed.current = true; openBooking(qr.data); }
        }
      }
      if (active && !completed.current) frame = requestAnimationFrame(scan);
    };
    navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}).then(async media => {
      if (!active) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      if (video.current) {
        video.current.srcObject = media;
        try { await video.current.play(); if (active) frame = requestAnimationFrame(scan); }
        catch { if (active) { setError("Unable to start the camera. Check browser camera permissions or upload a QR image."); setScanning(false); } }
      }
    }).catch(() => { if (active) { setError("Camera access was denied or unavailable. Allow camera permission in your browser settings, or upload a QR image."); setScanning(false); } });
    return () => { active = false; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()); };
  }, [scanning]);

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose a QR image smaller than 10 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", {willReadFrequently:true});
      context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      if (!context) throw new Error("Image processing unavailable");
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height);
      if (result) openBooking(result.data);
      else setError("No QR code found in this image. Try a clearer picture of the clinic's booking QR.");
    } catch { setError("Unable to read this image. Try another PNG, JPEG or WebP image."); }
  }

  return <div className="public-book">
    <Logo/>
    <main className="panel padded">
      <span className="eyebrow">Patient Access · No Login Needed</span>
      <h1>Scan a Clinic Booking QR Code</h1>
      <p>Scan the QR displayed at your clinic. We’ll show the clinic and location before you request a visit. You can also use your phone’s camera app to open the QR link directly.</p>
      <button className="button" type="button" data-testid="button-start-patient-scan" onClick={() => {completed.current = false; setError(""); setScanning(value => !value);}}><Camera size={18}/>{scanning ? "Stop camera" : "Start camera"}</button>
      {scanning && <video className="patient-scan-video" ref={video} playsInline muted aria-label="Camera preview for clinic booking QR"/>}
      <label className="patient-scan-upload"><ImageIcon size={18}/> Upload a QR image
        <input data-testid="input-patient-qr-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {void upload(event.target.files?.[0]);event.target.value = "";}}/>
      </label>
      {error && <div className="error-box" role="alert" data-testid="status-patient-scan-error">{error}</div>}
      <p className="muted">No QR code? <Link href="/guest-booking" className="text-link" data-testid="link-scanner-guest">Choose a Clinic for Guest Booking</Link></p>
    </main>
  </div>;
}