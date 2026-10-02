import sharp from "sharp";
import { assert } from "./http";
export async function sanitizeLogo(bytes: Buffer) {
  assert(bytes.length > 0 && bytes.length <= 2097152, 400, "Logo must be at most 2 MB");
  try {
    const image = sharp(bytes, { limitInputPixels: 4194304, animated: false });
    const info = await image.metadata();
    assert(["png", "jpeg", "webp"].includes(info.format || "") && !!info.width && !!info.height && info.width <= 2048 && info.height <= 2048 && (info.pages || 1) === 1, 400, "Unsupported image");
    return await image.rotate().png().toBuffer();
  } catch { assert(false, 400, "Invalid logo. Use a still PNG, JPEG or WebP up to 2048 × 2048"); }
}