import { Readable } from "node:stream";

/** No sockets, credentials resolution, provider discovery or remote writes. */
export function fakeS3() {
  const state = { blobs: new Map(), calls: [], mode: "", destroyed: 0, bodiesDestroyed: 0 };
  state.factory = () => ({
    destroy() { state.destroyed++; },
    async send(command, { abortSignal } = {}) {
      const name = command.constructor.name, input = command.input;
      state.calls.push({ name, input, abortSignal });
      const key = input.Bucket + "/" + input.Key;
      if (state.mode === "hang") return new Promise(() => {});
      if (state.mode === "denied") throw new Error("AccessDenied secret-key DO-NOT-LOG https://private.invalid Authorization=secret");
      if (name === "PutObjectCommand") {
        if (state.blobs.has(key)) throw new Error("PreconditionFailed");
        state.blobs.set(key, Buffer.from(input.Body));
        if (state.mode === "after-write") throw new Error("connection lost after commit DO-NOT-LOG");
        return {};
      }
      if (name === "DeleteObjectCommand") { state.blobs.delete(key); return {}; }
      const bytes = state.blobs.get(key);
      if (!bytes) throw new Error("NoSuchKey DO-NOT-LOG");
      const ContentLength = state.mode === "oversize" ? 10 * 1024 * 1024 + 1 : bytes.length;
      if (name === "HeadObjectCommand") return { ContentLength, ContentType: "application/pdf" };
      const Body = state.mode === "slow-body" ? new Readable({read(){}}) :
        Readable.from([state.mode === "truncated" ? bytes.subarray(1) :
          state.mode === "overrun" ? Buffer.concat([bytes, bytes]) : bytes]);
      Body.once("close", () => state.bodiesDestroyed++);
      return { ContentLength, Body };
    },
  });
  return state;
}
