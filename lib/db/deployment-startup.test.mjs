import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const command = packageJson.scripts["start:selfhost"];

async function startupFixture(failSeed) {
  const dir = await mkdtemp(join(tmpdir(), "digiq-startup-"));
  try {
    await mkdir(join(dir, "lib/db"), { recursive: true });
    await mkdir(join(dir, "artifacts/api-server/dist"), { recursive: true });
    await writeFile(join(dir, ".env"), `BOOTSTRAP_FIXTURE=loaded\nSEED_FAIL=${failSeed ? "1" : "0"}\n`);
    await writeFile(join(dir, "lib/db/seed.mjs"), `
      import { writeFileSync } from "node:fs";
      if (process.env.BOOTSTRAP_FIXTURE !== "loaded") process.exit(2);
      writeFileSync("seed-ran", "yes");
      if (process.env.SEED_FAIL === "1") process.exit(3);
    `);
    await writeFile(join(dir, "artifacts/api-server/dist/index.mjs"), `
      import { existsSync, writeFileSync } from "node:fs";
      if (!existsSync("seed-ran") || process.env.BOOTSTRAP_FIXTURE !== "loaded") process.exit(4);
      writeFileSync("api-ran", "yes");
    `);
    // Execute the exact configured startup chain with isolated harmless entrypoints.
    // Do not pass workspace credentials or connect to a database.
    const child = spawnSync("sh", ["-c", command], {
      cwd: dir, env: { PATH: process.env.PATH }, encoding: "utf8", timeout: 10_000,
    });
    const seedRan = await readFile(join(dir, "seed-ran"), "utf8").catch(() => null);
    const apiRan = await readFile(join(dir, "api-ran"), "utf8").catch(() => null);
    return { status: child.status, error: child.error, seedRan, apiRan };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("self-hosted startup always seeds before serving and loads the private env file in both processes", async () => {
  assert.match(command, /lib\/db\/seed\.mjs && exec node/);
  const result = await startupFixture(false);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.seedRan, "yes");
  assert.equal(result.apiRan, "yes");
});

test("failed superadmin seed prevents self-hosted API startup", async () => {
  const result = await startupFixture(true);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 3);
  assert.equal(result.seedRan, "yes");
  assert.equal(result.apiRan, null);
});

test("Replit production startup retains seed-before-API ordering without runtime migrations", async () => {
  const artifact = await readFile(new URL("artifacts/api-server/.replit-artifact/artifact.toml", root), "utf8");
  const productionRun = artifact.split("[services.production.run]")[1].split("[services.production.run.env]")[0];
  assert.match(productionRun, /pnpm --filter @workspace\/db run seed && exec node/);
  assert.doesNotMatch(productionRun, /deploy:prepare|drizzle-kit|run migrate/);
});
