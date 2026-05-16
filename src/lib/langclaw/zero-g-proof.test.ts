import assert from "node:assert/strict";
import test from "node:test";

import { waitForSubmittedTransactionReceipt } from "./zero-g-proof";

const txHash =
  "0xa5cf68642dcea719cc19eea4b9122551c7ce253b3d8b28747b5494aa7be66d2c";

test("receipt polling treats temporary receipt misses as pending", async () => {
  const receipt = await waitForSubmittedTransactionReceipt({
    attempts: 2,
    intervalMs: 0,
    publicClient: {
      async getTransactionReceipt() {
        throw new Error(
          `Transaction receipt with hash "${txHash}" could not be found. The Transaction may not be processed on a block yet.`
        );
      },
    },
    txHash,
  });

  assert.equal(receipt, undefined);
});

test("receipt polling returns a later successful receipt", async () => {
  let calls = 0;
  const receipt = await waitForSubmittedTransactionReceipt({
    attempts: 3,
    intervalMs: 0,
    publicClient: {
      async getTransactionReceipt() {
        calls += 1;

        if (calls === 1) {
          return undefined;
        }

        return { status: "success" };
      },
    },
    txHash,
  });

  assert.deepEqual(receipt, { status: "success" });
  assert.equal(calls, 2);
});

test("receipt polling does not hide real RPC errors", async () => {
  await assert.rejects(
    waitForSubmittedTransactionReceipt({
      attempts: 2,
      intervalMs: 0,
      publicClient: {
        async getTransactionReceipt() {
          throw new Error("RPC method unavailable");
        },
      },
      txHash,
    }),
    /RPC method unavailable/
  );
});
