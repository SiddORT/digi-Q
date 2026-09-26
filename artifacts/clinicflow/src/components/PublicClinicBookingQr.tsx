import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PublicClinicBookingQr({ bookingUrl, branchName }: { bookingUrl: string; branchName: string }) {
  const [result, setResult] = useState<{ url: string; image?: string; error?: string }>({ url: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(bookingUrl, { width: 240, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0d2350", light: "#ffffff" } })
      .then(image => { if (active) setResult({ url: bookingUrl, image }); })
      .catch(() => { if (active) setResult({ url: bookingUrl, error: "The booking QR could not be rendered. You can still use the booking link." }); });
    return () => { active = false; };
  }, [bookingUrl, attempt]);
  const current = result.url === bookingUrl ? result : null;
  return <section className="public-clinic-booking-qr" aria-label="Scan to book">
    {current?.image ? <a href={bookingUrl} data-testid="public-booking-qr-link"><img width={144} height={144} src={current.image} alt={`Scan to book at ${branchName}`} data-testid="public-booking-qr"/></a> : current?.error ? <div role="alert"><p>{current.error}</p><button type="button" className="text-link" data-testid="public-booking-qr-retry" onClick={() => setAttempt(n => n + 1)}>Retry QR</button></div> : <p role="status">Preparing booking QR…</p>}
    <div><strong>Scan to book</strong><p>Open booking for {branchName} on your phone.</p><a href={bookingUrl} className="text-link" data-testid="public-booking-qr-url">Open booking link</a></div>
  </section>;
}