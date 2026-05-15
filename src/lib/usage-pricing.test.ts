import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMarkupNeuron,
  calculateMarkupNeuron,
  calculateTokenCostNeuron,
  mapUiTokenUsage,
  readUsageMarkupBps,
  selectUsageCost,
} from "./usage-pricing";
import { withEnv } from "../test/helpers";

test("calculates raw cost from token usage", () => {
  assert.equal(
    calculateTokenCostNeuron({
      completionPriceNeuron: "5",
      completionTokens: 7,
      promptPriceNeuron: "2",
      promptTokens: 11,
    }),
    "57"
  );
});

test("uses Router trace cost before token pricing", () => {
  const selected = selectUsageCost({
    completionPriceNeuron: "5",
    computeStatus: "used",
    promptPriceNeuron: "2",
    reservedNeuron: "999",
    routerTrace: { billing: { totalCostNeuron: "123" } },
    tokenUsage: { completionTokens: 7, promptTokens: 11 },
  });

  assert.deepEqual(selected, {
    chargedRawNeuron: "123",
    costSource: "router-trace",
    status: "charged",
  });
});

test("falls back to reserved estimate when trace and usage are missing", () => {
  const selected = selectUsageCost({
    completionPriceNeuron: "5",
    computeStatus: "used",
    promptPriceNeuron: "2",
    reservedNeuron: "999",
  });

  assert.deepEqual(selected, {
    chargedRawNeuron: "999",
    costSource: "reserved-estimate",
    status: "estimated",
  });
});

test("default usage markup is 30 percent", async () => {
  await withEnv({ LANGCLAW_USAGE_MARKUP_BPS: undefined }, () => {
    assert.equal(readUsageMarkupBps(), 3000);
    assert.equal(calculateMarkupNeuron("1000", readUsageMarkupBps()), "300");
    assert.equal(applyMarkupNeuron("1000", readUsageMarkupBps()), "1300");
  });
});

test("honors custom LANGCLAW_USAGE_MARKUP_BPS", async () => {
  await withEnv({ LANGCLAW_USAGE_MARKUP_BPS: "1250" }, () => {
    assert.equal(readUsageMarkupBps(), 1250);
    assert.equal(calculateMarkupNeuron("1000", readUsageMarkupBps()), "125");
    assert.equal(applyMarkupNeuron("1000", readUsageMarkupBps()), "1125");
  });
});

test("maps token usage into UI-ready fields while keeping legacy fields", () => {
  assert.deepEqual(
    mapUiTokenUsage({
      cachedInputTokens: 3,
      completionTokens: 7,
      maxTokens: 64,
      promptTokens: 11,
      reasoningTokens: 2,
      totalTokens: 18,
    }),
    {
      cachedInputTokens: 3,
      completionTokens: 7,
      inputTokens: 11,
      maxTokens: 64,
      outputTokens: 7,
      promptTokens: 11,
      reasoningTokens: 2,
      totalTokens: 18,
    }
  );
});
