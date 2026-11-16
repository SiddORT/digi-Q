// Migration differential check. Capture before changing dependencies, compare after.
// All values are synthetic and bounded; no database or provider is contacted.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(resolve("artifacts/api-server/package.json"));
const { build } = require("esbuild");
const result = await build({
  entryPoints: ["lib/api-zod/src/index.ts"], bundle: true, write: false,
  platform: "node", format: "esm",
});
const schemas = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const file = resolve("generated-artifacts/f02-contract-baseline.json");
await mkdir(resolve("generated-artifacts"), { recursive: true });
const capture = process.argv.includes("--capture");
const baseline = capture ? {} : JSON.parse(await readFile(file, "utf8"));
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
// Zod 3 seed discovery is used only for the pre-migration capture, never as an adapter.
function seed(s, depth = 0) {
  if (depth > 20) throw Error("Unexpected recursive contract");
  const d = s._def;
  switch (d.typeName) {
    case "ZodObject": return Object.fromEntries(Object.entries(d.shape()).map(([k, v]) => [k, seed(v, depth + 1)]));
    case "ZodOptional": case "ZodVoid": return undefined;
    case "ZodNullable": return null;
    case "ZodDefault": return d.defaultValue();
    case "ZodEffects": return seed(d.schema, depth + 1);
    case "ZodUnion": return seed(d.options[0], depth + 1);
    case "ZodIntersection": return { ...seed(d.left, depth + 1), ...seed(d.right, depth + 1) };
    case "ZodEnum": return d.values[0];
    case "ZodLiteral": return d.value;
    case "ZodBoolean": return false;
    case "ZodNumber": return Math.max(1, ...d.checks.filter(c => c.kind === "min").map(c => c.value));
    case "ZodBigInt": return 1n;
    case "ZodDate": return "2026-01-01";
    case "ZodArray": return Array.from({ length: Math.min(d.exactLength?.value ?? d.minLength?.value ?? 0, 100) }, () => seed(d.type, depth + 1));
    case "ZodRecord": return {};
    case "ZodNull": return null;
    case "ZodAny": case "ZodUnknown": return {};
    case "ZodString": {
      if (d.checks.some(c => c.kind === "email")) return "synthetic@example.test";
      if (d.checks.some(c => c.kind === "url")) return "https://example.test";
      if (d.checks.some(c => c.kind === "uuid")) return "11111111-1111-4111-8111-111111111111";
      if (d.checks.some(c => c.kind === "datetime")) return "2026-01-01T00:00:00Z";
      return "x".repeat(Math.max(1, ...d.checks.filter(c => c.kind === "min" || c.kind === "length").map(c => Math.min(c.value, 1024))));
    }
    default: throw Error(`Unhandled seed type ${d.typeName}`);
  }
}
function outcome(schema, value) {
  const r = schema.safeParse(value);
  return r.success ? { success: true, data: r.data } : {
    success: false, paths: [...new Set(r.error.issues.map(i => JSON.stringify(i.path)))].sort(),
  };
}
const stringify = value => JSON.stringify(value, (_, v) => typeof v === "bigint" ? { $bigint: String(v) } : v);
const differences = [];
const requiredFieldGuards = [];
let cases = 0, acceptedSeeds = 0;
const next = {};
for (const [name, schema] of Object.entries(schemas)) {
  if (typeof schema?.safeParse !== "function") continue;
  const initial = capture ? seed(schema) : baseline[name]?.seed;
  const value = initial === undefined ? undefined : JSON.parse(stringify(initial));
  if (!capture && !baseline[name]) { differences.push(`${name}: new schema export`); continue; }
  const inputs = [undefined, null, {}, [], "", "2026-01-01", 0, true, value];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    inputs.push({ ...value, __unexpected: "must not be retained" });
    for (const key of Object.keys(value)) {
      for (const replacement of [undefined, null, "", 0, [], {}]) inputs.push({ ...value, [key]: replacement });
    }
  }
  const outcomes = inputs.map(v => JSON.parse(stringify(outcome(schema, v))));
  cases += outcomes.length;
  if (outcomes[8].success) acceptedSeeds++;
  next[name] = { seed: value, hash: hash(outcomes), cases: outcomes.length, outcomes };
  if (!capture && baseline[name].hash !== next[name].hash) {
    const changed = outcomes.flatMap((v, i) => JSON.stringify(v) !== JSON.stringify(baseline[name].outcomes[i]) ? [{ index: i, input: inputs[i], before: baseline[name].outcomes[i], after: v }] : []);
    // Zod 4's object parser no longer materializes absent required coerced
    // strings as "undefined". HTTP queries already reject that sentinel and
    // Express cannot route a missing required path segment. Never restore it
    // with a preprocessing shim. Permit only this exact, non-broadening change.
    const expected = changed.length === 1 && changed[0].index === 2 && !changed[0].after.success &&
      changed[0].after.paths.every(path => {
        if (changed[0].before.paths?.includes(path)) return true;
        const keys = JSON.parse(path);
        const field = keys.length === 1 ? schema.shape?.[keys[0]] : undefined;
        return field?.def?.type === "string" && field.def.coerce === true;
      }) &&
      (changed[0].before.paths ?? []).every(path => changed[0].after.paths.includes(path));
    (expected ? requiredFieldGuards : differences).push({ name, changed });
  }
}
if (!capture) for (const name of Object.keys(baseline)) if (!next[name]) differences.push(`${name}: removed schema export`);
if (capture) await writeFile(file, stringify(next));
else await writeFile(resolve("generated-artifacts/f02-contract-differences.json"), stringify(differences));
const summary = { mode: capture ? "capture" : "compare", schemas: Object.keys(next).length, cases, acceptedSeeds,
  requiredFieldGuards: requiredFieldGuards.length, unexpectedDifferences: differences.length };
console.log(JSON.stringify(summary));
if (process.argv.includes("--record-evidence")) {
  if (capture || differences.length) throw Error("Only a successful comparison may be recorded");
  await writeFile(resolve("docs/security/f02-contract-evidence.json"), JSON.stringify({
    ...summary, baselineSha256: hash(baseline), capturedAt: new Date().toISOString(),
    note: "Synthetic values only. Baseline captured on Zod 3.25.76 before migration. Issue wording is tested separately from acceptance, parsed output and issue paths.",
    requiredFieldGuards: requiredFieldGuards.map(({ name, changed }) => ({ name, before: changed[0].before, after: changed[0].after })),
  }, null, 2) + "\n");
}
if (differences.length) {
  console.log(JSON.stringify(differences.slice(0, 4), null, 2));
  process.exitCode = 1;
}
