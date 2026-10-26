import { useEffect, useState } from "react";

/** No scripts, forms, navigation capabilities or same-origin access. CSP also
 * blocks network access except deliberately supplied HTTPS/data logo images. */
export function emailPreviewDocument(html: string, allowRemoteImages = false) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${allowRemoteImages ? "https: " : ""}data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><meta name="referrer" content="no-referrer">`;
  return html.replace(/<head>/i, `<head>${policy}`);
}

export function EmailHtmlPreview({ html }: { html: string }) {
  const [remote, setRemote] = useState(false);
  useEffect(() => setRemote(false), [html]);
  return <div>
    {/<img\b[^>]*src="https:/i.test(html) && !remote && <button type="button" className="button secondary small"
      onClick={() => setRemote(true)}>Load External Logo (Contacts the Image Host)</button>}
    <iframe title="Rendered email preview" sandbox="" referrerPolicy="no-referrer"
      srcDoc={emailPreviewDocument(html, remote)} data-testid="email-html-preview"
      style={{ display: "block", width: "100%", height: 680, border: "1px solid #dfe7f1", borderRadius: 8, background: "#f2f5f9" }} />
  </div>;
}
