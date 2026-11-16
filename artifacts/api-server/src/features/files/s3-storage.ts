import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { assert, HttpError } from "../../lib/http";
import { DOCUMENT_MAX_BYTES } from "../../lib/feature-policy";
import { PRIVATE_FILE_KEY } from "./keys";
import { s3FileConfig, s3BucketValid } from "./s3-config";

type Config = ReturnType<typeof s3FileConfig>;
type Client = Pick<S3Client, "send" | "destroy">;
const TIMEOUT_MS = 20_000;
const failure = () => new HttpError(503, "Private file storage is unavailable; retry after checking the file state");

/** Server-only options; never serialize these (they may contain credentials). */
export function s3ClientOptions(c: Config) {
  return {
    region: c.region, endpoint: c.endpoint, forcePathStyle: c.forcePathStyle,
    credentials: c.credentials, maxAttempts: 1, followRegionRedirects: false,
    // SDK-global AWS_ENDPOINT_URL[_S3]/shared config must not bypass the
    // authority bound into our locators.
    ignoreConfiguredEndpointUrls: true,
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 15_000 },
    requestChecksumCalculation: "WHEN_REQUIRED" as const, responseChecksumValidation: "WHEN_REQUIRED" as const,
  };
}

export function s3Locator(key: string, config = s3FileConfig()) {
  assert(PRIVATE_FILE_KEY.test(key), 400, "Invalid private locator");
  return `s3:${config.authority}:${config.bucket}/${config.prefix}/${key}`;
}
function target(locator: string, config: Config) {
  const match = /^s3:([a-f0-9]{64}):([^/]+)\/(.+)$/.exec(locator);
  assert(match && match[1] === config.authority && s3BucketValid(match[2]), 409, "Private S3 locator is unavailable");
  const split = match[3].lastIndexOf("/private/clinics/");
  const prefix = match[3].slice(0, split);
  assert(split > 0 && prefix.length <= 256 && prefix.split("/").every(p => /^[A-Za-z0-9_-]+$/.test(p)) &&
    PRIVATE_FILE_KEY.test(match[3].slice(split + 1)), 409, "Invalid private S3 locator");
  return { Bucket: match[2], Key: match[3] };
}

/** Factory injection is test-only dependency injection, not a runtime/browser
 * setting. A fresh, bounded client avoids retaining rotated credentials. */
export function createS3FileAdapter(
  config: Config,
  clientFactory: (config: Config) => Client = c => new S3Client(s3ClientOptions(c)),
  timeoutMs = TIMEOUT_MS,
) {
  async function bounded<T>(work: (client: Client, signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let client: Client | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(failure()); }, timeoutMs);
        }),
        Promise.resolve().then(() => { client = clientFactory(config); return work(client, controller.signal); }),
      ]);
    } catch {
      // Never propagate SDK errors, endpoints, signed headers, request bodies,
      // credential resolution errors or raw causes into logs/responses.
      throw failure();
    } finally { clearTimeout(timer); client?.destroy(); }
  }
  return {
    locator: (key: string) => s3Locator(key, config),
    async upload(locator: string, bytes: Buffer, contentType: string) {
      const dest = target(locator, config);
      assert(bytes.length > 0 && bytes.length <= DOCUMENT_MAX_BYTES, 400, "Invalid file size");
      assert(dest.Bucket === config.bucket && locator === s3Locator(dest.Key.slice(config.prefix.length + 1), config),
        409, "Upload locator does not match selected storage");
      await bounded((client, abortSignal) => client.send(new PutObjectCommand({
        ...dest, Body: bytes, ContentType: contentType, ContentLength: bytes.length,
        CacheControl: "private, no-store", IfNoneMatch: "*",
        ChecksumSHA256: createHash("sha256").update(bytes).digest("base64"),
        // No public ACL, presigned upload, multipart state or public URL.
      }), { abortSignal }));
    },
    async head(locator: string) {
      const dest = target(locator, config);
      return bounded(async (client, abortSignal) => {
        const result = await client.send(new HeadObjectCommand(dest), { abortSignal });
        assert(Number.isSafeInteger(result.ContentLength) && result.ContentLength! > 0 &&
          result.ContentLength! <= DOCUMENT_MAX_BYTES, 409, "Invalid stored file size");
        return { size: result.ContentLength!, contentType: result.ContentType };
      });
    },
    async read(locator: string): Promise<Buffer> {
      const dest = target(locator, config);
      return bounded(async (client, abortSignal) => {
        const result = await client.send(new GetObjectCommand(dest), { abortSignal });
        const body = result.Body;
        const stop = () => { if (body && "destroy" in body && typeof body.destroy === "function") body.destroy(); };
        abortSignal.addEventListener("abort", stop, { once: true });
        try {
          assert(!abortSignal.aborted, 503, "Storage timeout");
          assert(Number.isSafeInteger(result.ContentLength) && result.ContentLength! > 0 &&
            result.ContentLength! <= DOCUMENT_MAX_BYTES && body && Symbol.asyncIterator in body, 409, "Invalid stored file size");
          let size = 0;
          const chunks: Buffer[] = [];
          for await (const part of body as AsyncIterable<Uint8Array>) {
            assert(!abortSignal.aborted, 503, "Storage timeout");
            const chunk = Buffer.from(part);
            size += chunk.length;
            assert(size <= DOCUMENT_MAX_BYTES && size <= result.ContentLength!, 409, "Invalid stored file size");
            chunks.push(chunk);
          }
          assert(size === result.ContentLength, 409, "Stored file was truncated");
          return Buffer.concat(chunks, size);
        } finally {
          abortSignal.removeEventListener("abort", stop);
          stop();
        }
      });
    },
    /** Not wired to a purge route. F03 user deletion remains soft, restorable
     * and authorized by the service. Any future byte erasure needs new approval. */
    async deleteIfAuthorized(locator: string, authorize: () => Promise<boolean>) {
      assert(await authorize(), 403, "Private file deletion is not authorized");
      const dest = target(locator, config);
      await bounded((client, abortSignal) => client.send(new DeleteObjectCommand(dest), { abortSignal }));
    },
  };
}
