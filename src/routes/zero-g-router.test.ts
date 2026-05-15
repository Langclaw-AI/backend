import assert from "node:assert/strict";
import test from "node:test";

import {
  handleZeroGAdminAccountBalance,
  handleZeroGChatCompletions,
  handleZeroGImageGeneration,
} from "./zero-g-router";
import { jsonResponse, mockFetch, withEnv } from "../test/helpers";

test("inference route without wallet returns 401", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/v1/models");

    return jsonResponse({
      data: [
        {
          id: "chat-model",
          pricing: { completion: "1", prompt: "1" },
          supported_parameters: ["max_tokens", "temperature"],
        },
      ],
    });
  });

  try {
    await withEnv(
      {
        OG_COMPUTE_ROUTER_URL: "https://router-route-wallet.test/v1",
        OG_DIRECT_CHAT_MODEL: "chat-model",
      },
      async () => {
        const response = await handleZeroGChatCompletions(
          new Request("http://localhost/api/0g/chat/completions", {
            body: JSON.stringify({
              messages: [{ content: "hello", role: "user" }],
              model: "chat-model",
            }),
            method: "POST",
          })
        );

        assert.equal(response.status, 401);
        assert.match(
          (await response.json() as { error: string }).error,
          /Wallet signature or API key is required/
        );
      }
    );
  } finally {
    restore();
  }
});

test("chat route accepts Playground-supported model parameters", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/v1/models");

    return jsonResponse({
      data: [
        {
          id: "deepseek-v4-pro",
          pricing: { completion: "1", prompt: "1" },
          supported_parameters: [
            "max_tokens",
            "preserve_thinking",
            "repetition_penalty",
          ],
          type: "chatbot",
        },
      ],
    });
  });

  try {
    await withEnv(
      {
        OG_COMPUTE_ROUTER_URL: "https://router-route-supported-params.test/v1",
      },
      async () => {
        const response = await handleZeroGChatCompletions(
          new Request("http://localhost/api/0g/chat/completions", {
            body: JSON.stringify({
              max_tokens: 8,
              messages: [{ content: "hello", role: "user" }],
              model: "deepseek-v4-pro",
              preserve_thinking: false,
              repetition_penalty: 1.1,
            }),
            method: "POST",
          })
        );

        assert.equal(response.status, 401);
        assert.match(
          (await response.json() as { error: string }).error,
          /Wallet signature or API key is required/
        );
      }
    );
  } finally {
    restore();
  }
});

test("chat route rejects non-chat Playground models", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/v1/models");

    return jsonResponse({
      data: [
        {
          id: "z-image",
          pricing: { image: "1" },
          supported_parameters: ["prompt", "response_format"],
          type: "text-to-image",
        },
      ],
    });
  });

  try {
    await withEnv(
      {
        OG_COMPUTE_ROUTER_URL: "https://router-route-wrong-service.test/v1",
      },
      async () => {
        const response = await handleZeroGChatCompletions(
          new Request("http://localhost/api/0g/chat/completions", {
            body: JSON.stringify({
              messages: [{ content: "hello", role: "user" }],
              model: "z-image",
            }),
            method: "POST",
          })
        );
        const body = await response.json() as {
          error: { message: string };
        };

        assert.equal(response.status, 400);
        assert.match(body.error.message, /cannot be used with the chat endpoint/);
      }
    );
  } finally {
    restore();
  }
});

test("image generation route rejects non-b64_json response format", async () => {
  const response = await handleZeroGImageGeneration(
    new Request("http://localhost/api/0g/images/generations", {
      body: JSON.stringify({
        prompt: "draw a verifier dashboard",
        response_format: "url",
      }),
      method: "POST",
    })
  );

  assert.equal(response.status, 400);
  assert.match(
    (await response.json() as { error: string }).error,
    /response_format must be b64_json/
  );
});

test("admin account endpoints require LANGCLAW_ADMIN_API_KEY", async () => {
  await withEnv({ LANGCLAW_ADMIN_API_KEY: "admin-secret" }, async () => {
    const response = await handleZeroGAdminAccountBalance(
      new Request("http://localhost/api/0g/admin/account/balance")
    );

    assert.equal(response.status, 401);
  });
});

test("admin account route preserves Retry-After on Router 429", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/v1/account/balance");

    return jsonResponse(
      {
        error: {
          code: "rate_limit",
          message: "too many requests",
          type: "rate_limit_error",
        },
        request_id: "req-429",
      },
      {
        headers: { "Retry-After": "9" },
        status: 429,
      }
    );
  });

  try {
    await withEnv(
      {
        LANGCLAW_ADMIN_API_KEY: "admin-secret",
        OG_COMPUTE_API_KEY: "router-key",
        OG_COMPUTE_ROUTER_URL: "https://router-admin-429.test/v1",
      },
      async () => {
        const response = await handleZeroGAdminAccountBalance(
          new Request("http://localhost/api/0g/admin/account/balance", {
            headers: { Authorization: "Bearer admin-secret" },
          })
        );
        const body = await response.json() as {
          error: { requestId?: string };
        };

        assert.equal(response.status, 429);
        assert.equal(response.headers.get("Retry-After"), "9");
        assert.equal(body.error.requestId, "req-429");
      }
    );
  } finally {
    restore();
  }
});
