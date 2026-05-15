import assert from "node:assert/strict";
import test from "node:test";

import { isExecutorAvailable } from "./executor";
import { getTokenBalances } from "./providers/alchemy";
import { getYieldPools } from "./providers/defillama";
import { searchPairs } from "./providers/dexscreener";
import { getLatestResult } from "./providers/dune";
import { getAccountBalance } from "./providers/etherscan";
import { getTokenSecurity } from "./providers/goplus";
import { assertRegistryShape, onChainCommands } from "./registry";
import { onChainDomains } from "./types";
import { jsonResponse, mockFetch, withEnv } from "../../test/helpers";

test("on-chain registry exposes at least 83 commands across exactly 14 domains", () => {
  const shape = assertRegistryShape();

  assert.equal(shape.expectedDomainCount, 14);
  assert.equal(shape.domainCount, 14);
  assert.ok(shape.commandCount >= 83);
  assert.equal(onChainDomains.length, 14);
});

test("on-chain registry commands have schemas, executors, providers, and risk levels", () => {
  for (const command of onChainCommands) {
    assert.ok(command.id.includes("."));
    assert.equal(command.paramsSchema.type, "object");
    assert.ok(command.provider);
    assert.ok(command.riskLevel);
    assert.ok(isExecutorAvailable(command.executor), command.executor);
  }
});

test("DEX Screener provider searches pairs", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/latest/dex/search");

    return jsonResponse({
      pairs: [
        {
          baseToken: { symbol: "TEST" },
          dexId: "uniswap",
          liquidity: { usd: 1000 },
          priceUsd: "1.23",
        },
      ],
    });
  });

  try {
    const result = await searchPairs({ chain: "base", query: "TEST" });

    assert.match(result.summary ?? "", /1 pairs returned/);
  } finally {
    restore();
  }
});

test("DeFiLlama provider filters yield pools by chain", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/pools");

    return jsonResponse({
      data: [
        { chain: "Base", project: "aave", tvlUsd: 100 },
        { chain: "Ethereum", project: "compound", tvlUsd: 200 },
      ],
    });
  });

  try {
    const result = await getYieldPools({ chain: "base" });

    assert.match(result.summary ?? "", /1 yield pools/);
  } finally {
    restore();
  }
});

test("Etherscan provider uses V2 chainid and API key", async () => {
  const restore = mockFetch((url) => {
    const parsed = new URL(url);

    assert.equal(parsed.pathname, "/v2/api");
    assert.equal(parsed.searchParams.get("chainid"), "8453");
    assert.equal(parsed.searchParams.get("module"), "account");
    assert.equal(parsed.searchParams.get("action"), "balance");
    assert.equal(parsed.searchParams.get("apikey"), "etherscan-test-key");

    return jsonResponse({ message: "OK", result: "1", status: "1" });
  });

  try {
    await withEnv({ ETHERSCAN_API_KEY: "etherscan-test-key" }, async () => {
      const result = await getAccountBalance({
        chain: "base",
        walletAddress: "0x1111111111111111111111111111111111111111",
      });

      assert.match(result.summary ?? "", /Fetched native account balance/);
    });
  } finally {
    restore();
  }
});

test("GoPlus provider calls token security endpoint", async () => {
  const restore = mockFetch((url, init) => {
    const parsed = new URL(url);

    assert.equal(parsed.pathname, "/api/v1/token_security/8453");
    assert.equal(init?.headers && typeof init.headers === "object", true);

    return jsonResponse({
      result: {
        "0x2222222222222222222222222222222222222222": {
          buy_tax: "0",
          is_honeypot: "0",
          sell_tax: "0",
        },
      },
    });
  });

  try {
    await withEnv(
      {
        GOPLUS_API_KEY: "goplus-key",
        GOPLUS_API_SECRET: "goplus-secret",
      },
      async () => {
        const result = await getTokenSecurity({
          chain: "base",
          tokenAddress: "0x2222222222222222222222222222222222222222",
        });

        assert.match(result.summary ?? "", /GoPlus token security/);
      }
    );
  } finally {
    restore();
  }
});

test("Alchemy provider posts token balance JSON-RPC request", async () => {
  const restore = mockFetch((url, init) => {
    assert.equal(url, "https://base-mainnet.g.alchemy.com/v2/alchemy-test-key");
    assert.equal(init?.method, "POST");

    const body = JSON.parse(String(init?.body)) as { method: string };
    assert.equal(body.method, "alchemy_getTokenBalances");

    return jsonResponse({ jsonrpc: "2.0", result: { tokenBalances: [] } });
  });

  try {
    await withEnv({ ALCHEMY_API_KEY: "alchemy-test-key" }, async () => {
      const result = await getTokenBalances({
        chain: "base",
        walletAddress: "0x3333333333333333333333333333333333333333",
      });

      assert.match(result.summary ?? "", /Alchemy/);
    });
  } finally {
    restore();
  }
});

test("Dune provider fetches latest configured query result", async () => {
  const restore = mockFetch((url, init) => {
    assert.equal(new URL(url).pathname, "/api/v1/query/123456/results");
    assert.ok(init?.headers);

    return jsonResponse({ result: { rows: [] } });
  });

  try {
    await withEnv({ DUNE_API_KEY: "dune-test-key" }, async () => {
      const result = await getLatestResult({ queryId: "123456" });

      assert.match(result.summary ?? "", /Dune query result/);
    });
  } finally {
    restore();
  }
});
