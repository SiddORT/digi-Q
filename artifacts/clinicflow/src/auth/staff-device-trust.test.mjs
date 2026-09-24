import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  activateAndProveStaffSession,
  createAsyncActionLock,
  DEVICE_CODE_LENGTH,
  DEVICE_CODE_RESEND_SECONDS,
  sendDeviceTrustEmailCode,
} from "./staff-device-trust.ts";

test("send success claims sent only after the provider resolves", async () => {
  const states = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const sending = sendDeviceTrustEmailCode({
    prepare: () => pending,
    setCodeSent: sent => states.push(sent),
    clearCode: () => states.push("cleared"),
    startCooldown: seconds => states.push(seconds),
  });

  await Promise.resolve();
  assert.deepEqual(states, [false]);
  release();
  await sending;
  assert.deepEqual(states, [false, "cleared", true, DEVICE_CODE_RESEND_SECONDS]);
});

test("send failure never claims that a code was sent", async () => {
  const states = [];
  await assert.rejects(
    sendDeviceTrustEmailCode({
      prepare: async () => { throw new Error("delivery failed"); },
      setCodeSent: sent => states.push(sent),
      clearCode: () => states.push("cleared"),
      startCooldown: seconds => states.push(seconds),
    }),
    /delivery failed/,
  );
  assert.deepEqual(states, [false]);
});

test("resend clears the previous sent claim before preparing again", async () => {
  const states = [];
  await sendDeviceTrustEmailCode({
    prepare: async () => states.push("prepared"),
    setCodeSent: sent => states.push(sent),
    clearCode: () => states.push("cleared"),
    startCooldown: seconds => states.push(seconds),
  });
  assert.deepEqual(states, [false, "prepared", "cleared", true, DEVICE_CODE_RESEND_SECONDS]);
});

test("returned session is activated before server password proof", async () => {
  const calls = [];
  await activateAndProveStaffSession({
    createdSessionId: "sess_returned",
    setActive: async id => calls.push(["active", id]),
    finalize: async () => { calls.push(["finalize"]); return { error: null }; },
    provePassword: async () => calls.push(["proof"]),
    cleanup: async () => calls.push(["cleanup"]),
  });
  assert.deepEqual(calls, [["active", "sess_returned"], ["proof"]]);
});

test("password proof failure cleans up the activated session", async () => {
  const calls = [];
  await assert.rejects(
    activateAndProveStaffSession({
      createdSessionId: "sess_returned",
      setActive: async () => calls.push("active"),
      finalize: async () => ({ error: null }),
      provePassword: async () => { calls.push("proof"); throw new Error("proof failed"); },
      cleanup: async () => calls.push("cleanup"),
    }),
    /proof failed/,
  );
  assert.deepEqual(calls, ["active", "proof", "cleanup"]);
});

test("async lock rejects double submissions and unlocks after completion", async () => {
  const changes = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const lock = createAsyncActionLock(value => changes.push(value));
  let runs = 0;

  const first = lock.run(async () => { runs += 1; await pending; });
  const second = await lock.run(async () => { runs += 1; });
  assert.equal(second, false);
  assert.equal(runs, 1);
  assert.equal(lock.isLocked(), true);
  release();
  assert.equal(await first, true);
  assert.equal(lock.isLocked(), false);
  assert.deepEqual(changes, [true, false]);
});

test("staff verification renders the installed OTP control with six slots", async () => {
  const component = await readFile(resolve(import.meta.dirname, "StaffLogin.tsx"), "utf8");
  assert.equal(DEVICE_CODE_LENGTH, 6);
  assert.match(component, /<OTPInput/);
  assert.match(component, /maxLength=\{DEVICE_CODE_LENGTH\}/);
  assert.match(component, /slots\.map/);
  assert.match(component, /code\.length !== DEVICE_CODE_LENGTH/);
});