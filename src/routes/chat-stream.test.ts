import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";

import {
  buildChatWorkflowOptions,
  handleChatStream,
} from "./chat-stream";
import { jsonResponse, mockFetch, readNdjson, withEnv } from "../test/helpers";

const testPrivateKey =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const authEnv = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  SUPABASE_URL: "https://supabase.test",
};

async function buildTestWallet() {
  const account = privateKeyToAccount(testPrivateKey);
  const message = `Login to Langclaw\nAddress: ${account.address}\nTime: ${new Date().toISOString()}`;
  const signature = await account.signMessage({ message });

  return {
    address: account.address,
    message,
    signature,
  };
}

function isSupabaseRequest(url: string) {
  return new URL(url).hostname === "supabase.test";
}

function supabaseWalletResponse() {
  return jsonResponse({
    id: "00000000-0000-4000-8000-000000000001",
    wallet_address: privateKeyToAccount(testPrivateKey).address.toLowerCase(),
  });
}

test("direct chat rejects attachments until multimodal contract exists", async () => {
  const response = await handleChatStream(
    new Request("http://localhost/api/chat/stream", {
      body: JSON.stringify({
        attachments: [{ name: "evidence.png" }],
        message: "analyze this",
      }),
      method: "POST",
    })
  );

  assert.equal(response.status, 400);
  assert.match(
    (await response.json() as { error: string }).error,
    /Multimodal attachments are not supported/
  );
});

test("direct chat rejects AI SDK FileUIPart payloads", async () => {
  const response = await handleChatStream(
    new Request("http://localhost/api/chat/stream", {
      body: JSON.stringify({
        message: {
          data: "base64",
          mimeType: "image/png",
          type: "file",
        },
      }),
      method: "POST",
    })
  );

  assert.equal(response.status, 400);
});

test("direct chat requires wallet auth", async () => {
  const response = await handleChatStream(
    new Request("http://localhost/api/chat/stream", {
      body: JSON.stringify({
        message: "halo",
      }),
      method: "POST",
    })
  );

  assert.equal(response.status, 401);
  assert.match((await response.json() as { error: string }).error, /required/);
});

test("direct chat honors supported body.model and returns metadata", async () => {
  const restore = mockFetch((url) => {
    if (isSupabaseRequest(url)) {
      return supabaseWalletResponse();
    }

    assert.equal(new URL(url).pathname, "/v1/models");

    return jsonResponse({
      data: [
        {
          id: "custom-chat",
          pricing: { completion: "1", prompt: "1" },
        },
      ],
    });
  });

  try {
    await withEnv(
      {
        ...authEnv,
        OG_COMPUTE_ENABLED: "false",
        OG_COMPUTE_ROUTER_URL: "https://router-direct-supported.test/v1",
        OG_DIRECT_CHAT_MODEL: "default-chat",
      },
      async () => {
        const response = await handleChatStream(
          new Request("http://localhost/api/chat/stream", {
            body: JSON.stringify({
              message: "halo",
              model: "custom-chat",
              wallet: await buildTestWallet(),
            }),
            method: "POST",
          })
        );
        const events = await readNdjson(response);
        const direct = events.find((event) => event.type === "direct");
        const payload = direct?.payload as Record<string, unknown>;

        assert.equal(response.status, 200);
        assert.equal(payload.requestedModel, "custom-chat");
        assert.equal(payload.usedModel, "custom-chat");
        assert.equal(payload.model, "custom-chat");
        assert.equal(payload.modelHonored, true);
      }
    );
  } finally {
    restore();
  }
});

test("direct chat returns explicit fallback metadata for unsupported model", async () => {
  const restore = mockFetch((url) =>
    isSupabaseRequest(url) ? supabaseWalletResponse() : jsonResponse({ data: [] })
  );

  try {
    await withEnv(
      {
        ...authEnv,
        OG_COMPUTE_ENABLED: "false",
        OG_COMPUTE_ROUTER_URL: "https://router-direct-unsupported.test/v1",
        OG_DIRECT_CHAT_MODEL: "default-chat",
      },
      async () => {
        const response = await handleChatStream(
          new Request("http://localhost/api/chat/stream", {
            body: JSON.stringify({
              message: "halo",
              model: "missing-chat",
              wallet: await buildTestWallet(),
            }),
            method: "POST",
          })
        );
        const events = await readNdjson(response);
        const direct = events.find((event) => event.type === "direct");
        const payload = direct?.payload as Record<string, unknown>;

        assert.equal(payload.requestedModel, "missing-chat");
        assert.equal(payload.usedModel, "default-chat");
        assert.equal(payload.fallbackFrom, "missing-chat");
        assert.equal(payload.modelHonored, false);
      }
    );
  } finally {
    restore();
  }
});

test("agent mode passes requested model into workflow options", () => {
  const options = buildChatWorkflowOptions("agent-model", () => undefined);

  assert.equal(options.requestedModel, "agent-model");
  assert.equal(typeof options.onEvent, "function");
});

test("on-chain tool mode streams plan, calls, results, and final payload", async () => {
  const restore = mockFetch((url) => {
    const parsed = new URL(url);

    if (isSupabaseRequest(url)) {
      return supabaseWalletResponse();
    }

    if (parsed.hostname === "api.dexscreener.com") {
      return jsonResponse({
        pairs: [
          {
            baseToken: { symbol: "BASE" },
            dexId: "uniswap",
            liquidity: { usd: 100000 },
            priceUsd: "1",
          },
        ],
      });
    }

    return jsonResponse({ ok: true });
  });

  try {
    await withEnv(authEnv, async () => {
      const response = await handleChatStream(
        new Request("http://localhost/api/chat/stream", {
          body: JSON.stringify({
            message: "Find trending tokens on Base",
            toolMode: "onchain",
            wallet: await buildTestWallet(),
          }),
          method: "POST",
        })
      );
      const events = await readNdjson(response);

      assert.equal(response.status, 200);
      assert.ok(events.some((event) => event.type === "tool_plan"));
      assert.ok(events.some((event) => event.type === "tool_call"));

      const toolResult = events.find((event) => event.type === "tool_result");
      const toolEvent = toolResult?.event as
        | { data?: unknown; sourceUrl?: string; status?: string }
        | undefined;

      assert.equal(toolEvent?.status, "success");
      assert.ok(toolEvent?.sourceUrl);
      assert.ok(toolEvent?.data);

      const toolFinal = events.find((event) => event.type === "tool_final");
      const payload = toolFinal?.payload as
        | { tools?: Array<{ data?: unknown }> }
        | undefined;

      assert.ok(payload?.tools?.some((tool) => tool.data));
    });
  } finally {
    restore();
  }
});
