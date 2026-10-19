import { test } from "node:test";
import assert from "node:assert/strict";
import { BackendBusy, retryBusy, pause } from "../src/request-retry.ts";
test("only explicit busy responses retry, with bounded attempts", async () => {
  let calls = 0;
  const waits = [];
  const result = await retryBusy(
    async () => {
      if (++calls < 3) throw new BackendBusy();
      return "ok";
    },
    undefined,
    async (ms) => {
      waits.push(ms);
    },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);
  calls = 0;
  await assert.rejects(
    () =>
      retryBusy(
        async () => {
          calls++;
          throw new BackendBusy();
        },
        undefined,
        async () => {},
      ),
    /still busy/,
  );
  assert.equal(calls, 5);
  calls = 0;
  await assert.rejects(
    () =>
      retryBusy(
        async () => {
          calls++;
          throw new Error("unauthorized");
        },
        undefined,
        async () => {
          throw new Error("unexpected retry");
        },
      ),
    /unauthorized/,
  );
  assert.equal(calls, 1);
});
test("canceling a backoff stops retries immediately", async () => {
  const controller = new AbortController();
  const pending = pause(10000, controller.signal);
  controller.abort(new Error("canceled"));
  await assert.rejects(() => pending, /canceled/);
});
