import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { build } from "esbuild";
const output = await build({ entryPoints: [new URL("./lib/logo-validation.ts", import.meta.url).pathname], bundle: true, write: false, platform: "node", format: "esm", packages: "external" });
const { sanitizeLogo } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text.replace('from "sharp"', `from "${import.meta.resolve("sharp")}"`).replace('from "zod"', `from "${import.meta.resolve("zod")}"`)).toString("base64")}`);
test("logo validation decodes and re-encodes allowed raster images; rejects SVG, garbage and oversized inputs", async () => {
  const valid = await sharp({ create: { width: 30, height: 20, channels: 3, background: "white" } }).jpeg().toBuffer();
  assert.equal((await sharp(await sanitizeLogo(valid)).metadata()).format, "png");
  await assert.rejects(sanitizeLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')), { status: 400 });
  await assert.rejects(sanitizeLogo(Buffer.from("not an image")), { status: 400 });
  await assert.rejects(sanitizeLogo(Buffer.alloc(2097153)), { status: 400 });
  const large = await sharp({ create: { width: 2049, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(sanitizeLogo(large), { status: 400 });
});