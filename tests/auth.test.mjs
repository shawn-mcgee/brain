import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { login } from "../src/auth.ts";
afterEach(() => {
  delete globalThis.window;
});
function stub(start) {
  globalThis.window = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options) => ({
            requestAccessToken: () => start(options),
          }),
        },
      },
    },
  };
}
test("Google sign-in resolves only a valid token response", async () => {
  stub((options) =>
    options.callback({ access_token: "test-token", expires_in: 3600 }),
  );
  assert.equal((await login("client")).token, "test-token");
  stub((options) => options.callback({}));
  await assert.rejects(() => login("client"), /incomplete/);
});
test("a missing Google callback times out instead of hanging forever", async () => {
  stub(() => {});
  await assert.rejects(
    () => login("client", { timeoutMs: 10 }),
    /did not finish/,
  );
});
test("cancellation rejects the attempt and ignores late callbacks", async () => {
  let callback;
  stub((options) => {
    callback = options.callback;
  });
  const controller = new AbortController();
  const pending = login("client", { signal: controller.signal });
  controller.abort();
  await assert.rejects(() => pending, /canceled/);
  callback({ access_token: "late-token", expires_in: 3600 });
});
test("popup errors and synchronous startup failures release the attempt", async () => {
  stub((options) => options.error_callback({ type: "popup_closed" }));
  await assert.rejects(() => login("client"), /canceled/);
  stub(() => {
    throw new Error("startup");
  });
  await assert.rejects(() => login("client"), /could not start/);
});
