import test from "node:test";
import assert from "node:assert/strict";
import { isTransientConvexError, withConvexRetry } from "../workers/convexRetry.mjs";

test("worker retry helper retries transient Convex failures", async () => {
  let attempts = 0;
  const result = await withConvexRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('{"code":"WorkerOverloaded","message":"There are no available workers"}');
      }
      return "ok";
    },
    { attempts: 3, baseDelayMs: 1 },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("worker retry helper does not retry non-transient errors", async () => {
  let attempts = 0;
  await assert.rejects(
    () => withConvexRetry(
      async () => {
        attempts += 1;
        throw new Error("Worker authorization required.");
      },
      { attempts: 3, baseDelayMs: 1 },
    ),
    /Worker authorization required/,
  );

  assert.equal(attempts, 1);
  assert.equal(isTransientConvexError(new Error("InternalServerError: Try again later")), true);
});
