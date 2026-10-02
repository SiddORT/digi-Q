export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MAX_SIDE = 2048;

/** Client-side precheck only; the server re-verifies type, size and dimensions. */
export function logoFileError(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return "Use a PNG, JPEG or WEBP image.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > LOGO_MAX_BYTES) return "The image is larger than 2 MB.";
  return null;
}

/** PUTs the raw file to a signed URL. No credentials or auth headers are sent. */
export function putToSignedUrl(url: string, file: Blob, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("Upload cancelled.")); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.withCredentials = false;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}
