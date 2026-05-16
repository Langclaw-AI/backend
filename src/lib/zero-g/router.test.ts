import assert from "node:assert/strict";
import test from "node:test";

import {
  chatCompletion,
  inferRouterModelService,
  listRouterModels,
  listRouterProviders,
  readAsyncJob,
  requireRouterModelForService,
  resolveRouterModelSelection,
  RouterHttpError,
  shouldRequestTeeVerification,
  streamChatCompletion,
} from "./router";
import {
  assertPath,
  jsonResponse,
  mockFetch,
  sseResponse,
  withEnv,
} from "../../test/helpers";

test("parses Router model catalog metadata and pricing", async () => {
  const restore = mockFetch((url) => {
    assertPath(url, "/v1/models");

    return jsonResponse({
      data: [
        {
          id: "chat-model",
          name: "Chat Model",
          pricing: { completion: "7", prompt: "3" },
          pricing_usd: { completion: "0.000007", prompt: "0.000003" },
          supported_parameters: ["temperature", 12, "max_tokens"],
        },
        { name: "missing id" },
      ],
    });
  });

  try {
    await withEnv(
      { OG_COMPUTE_ROUTER_URL: "https://router-models.test/v1" },
      async () => {
        const models = await listRouterModels();

        assert.equal(models.length, 1);
        assert.equal(models[0].id, "chat-model");
        assert.deepEqual(models[0].pricing, {
          completion: "7",
          prompt: "3",
        });
        assert.deepEqual(models[0].supported_parameters, [
          "temperature",
          "max_tokens",
        ]);
        assert.deepEqual(models[0].supported_formats, undefined);
      }
    );
  } finally {
    restore();
  }
});

test("classifies Playground model service types", () => {
  assert.equal(inferRouterModelService({
    id: "0GM-1.0-35B-A3B",
    type: "chatbot",
  }), "chat");
  assert.equal(inferRouterModelService({
    id: "z-image",
    type: "text-to-image",
  }), "image");
  assert.equal(inferRouterModelService({
    id: "openai/whisper-large-v3",
    type: "speech-to-text",
  }), "audio");
});

test("rejects model use on the wrong Router endpoint", () => {
  assert.throws(
    () =>
      requireRouterModelForService({
        model: { id: "z-image", type: "text-to-image" },
        modelId: "z-image",
        service: "chat",
      }),
    (error: unknown) => {
      assert.ok(error instanceof RouterHttpError);
      assert.equal(error.status, 400);
      assert.match(error.message, /cannot be used with the chat endpoint/);

      return true;
    }
  );
});

test("model selection only honors models for the requested service", async () => {
  const restore = mockFetch(() =>
    jsonResponse({
      data: [
        { id: "z-image", type: "text-to-image" },
      ],
    })
  );

  try {
    await withEnv(
      {
        OG_COMPUTE_MODEL: "default-chat",
        OG_COMPUTE_ROUTER_URL: "https://router-selection-service.test/v1",
      },
      async () => {
        const selection = await resolveRouterModelSelection({
          requestedModel: "z-image",
          service: "chat",
        });

        assert.equal(selection.modelHonored, false);
        assert.equal(selection.fallbackFrom, "z-image");
        assert.equal(selection.usedModel, "default-chat");
      }
    );
  } finally {
    restore();
  }
});

test("generates provider list query parameters", async () => {
  const seen: string[] = [];
  const restore = mockFetch((url) => {
    seen.push(url);

    return jsonResponse({ data: [] });
  });

  try {
    await withEnv(
      { OG_COMPUTE_ROUTER_URL: "https://router-providers.test/v1" },
      async () => {
        await listRouterProviders({
          model: "chat-model",
          service_type: "chat",
        });
      }
    );
  } finally {
    restore();
  }

  const url = new URL(seen[0]);
  assert.equal(url.pathname, "/v1/providers");
  assert.equal(url.searchParams.get("model"), "chat-model");
  assert.equal(url.searchParams.get("service_type"), "chat");
});

test("async image job poll includes model and TEE query parameters", async () => {
  const seen: string[] = [];
  const restore = mockFetch((url) => {
    seen.push(url);

    return jsonResponse({
      status: "pending",
      x_0g_trace: {
        tee_verified: true,
      },
    });
  });

  try {
    await withEnv(
      {
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-async-job.test/v1",
      },
      async () => {
        await readAsyncJob({
          jobId: "job-123",
          model: "z-image",
          providerAddress: "0xprovider",
          verifyTee: true,
        });
      }
    );
  } finally {
    restore();
  }

  const url = new URL(seen[0]);

  assert.equal(url.pathname, "/v1/async/jobs/job-123");
  assert.equal(url.searchParams.get("model"), "z-image");
  assert.equal(url.searchParams.get("provider_address"), "0xprovider");
  assert.equal(url.searchParams.get("verify_tee"), "true");
});

test("parses chat response usage into legacy and UI token fields", async () => {
  const restore = mockFetch((url) => {
    assertPath(url, "/v1/chat/completions");

    return jsonResponse({
      choices: [{ message: { content: "ok" } }],
      usage: {
        completion_tokens: 7,
        completion_tokens_details: { reasoning_tokens: 2 },
        max_tokens: 64,
        prompt_tokens: 11,
        prompt_tokens_details: { cached_tokens: 4 },
        total_tokens: 18,
      },
    });
  });

  try {
    await withEnv(
      {
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-chat-usage.test/v1",
      },
      async () => {
        const result = await chatCompletion({
          messages: [{ content: "hello", role: "user" }],
          model: "chat-model",
        });

        assert.deepEqual(result.usage, {
          cachedInputTokens: 4,
          completionTokens: 7,
          inputTokens: 11,
          maxTokens: 64,
          outputTokens: 7,
          promptTokens: 11,
          reasoningTokens: 2,
          totalTokens: 18,
        });
      }
    );
  } finally {
    restore();
  }
});

test("parses Router billing trace from chat responses", async () => {
  const restore = mockFetch(() =>
    jsonResponse({
      choices: [{ message: { content: "ok" } }],
      x_0g_trace: {
        billing: {
          input_cost: "10",
          output_cost: "20",
          total_cost: "30",
        },
        provider: "0xprovider",
        request_id: "req-1",
        tee_verified: true,
      },
    })
  );

  try {
    await withEnv(
      {
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-chat-trace.test/v1",
      },
      async () => {
        const result = await chatCompletion({
          messages: [{ content: "hello", role: "user" }],
          model: "chat-model",
        });

        assert.deepEqual(result.trace, {
          billing: {
            inputCostNeuron: "10",
            outputCostNeuron: "20",
            totalCostNeuron: "30",
          },
          provider: "0xprovider",
          requestId: "req-1",
          teeVerified: true,
        });
      }
    );
  } finally {
    restore();
  }
});

test("parses streaming deltas, usage, and final trace", async () => {
  const deltas: string[] = [];
  const restore = mockFetch(() =>
    sseResponse([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      'data: {"choices":[{"delta":{"content":"lo"}}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5},"x_0g_trace":{"billing":{"total_cost":"99"},"provider":"0xabc","request_id":"req-stream","tee_verified":false}}',
      "data: [DONE]",
    ])
  );

  try {
    await withEnv(
      {
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-stream.test/v1",
      },
      async () => {
        const result = await streamChatCompletion({
          onDelta: (delta) => deltas.push(delta),
          payload: {
            messages: [{ content: "hello", role: "user" }],
            model: "chat-model",
          },
        });

        assert.equal(result.answer, "Hello");
        assert.deepEqual(deltas, ["Hel", "lo"]);
        assert.equal(result.usage?.inputTokens, 2);
        assert.equal(result.usage?.outputTokens, 3);
        assert.equal(result.trace?.billing?.totalCostNeuron, "99");
        assert.equal(result.trace?.requestId, "req-stream");
      }
    );
  } finally {
    restore();
  }
});

test("preserves whitespace and newlines in streaming deltas", async () => {
  const deltas: string[] = [];
  const restore = mockFetch(() =>
    sseResponse([
      'data: {"choices":[{"delta":{"content":"Here"}}]}',
      'data: {"choices":[{"delta":{"content":" is"}}]}',
      'data: {"choices":[{"delta":{"content":"\\n\\n| A | B |"}}]}',
      'data: {"choices":[{"delta":{"content":"\\n| - | - |"}}]}',
      "data: [DONE]",
    ])
  );

  try {
    await withEnv(
      {
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-stream.test/v1",
      },
      async () => {
        const result = await streamChatCompletion({
          onDelta: (delta) => deltas.push(delta),
          payload: {
            messages: [{ content: "hello", role: "user" }],
            model: "chat-model",
          },
        });

        assert.equal(result.answer, "Here is\n\n| A | B |\n| - | - |");
        assert.deepEqual(deltas, [
          "Here",
          " is",
          "\n\n| A | B |",
          "\n| - | - |",
        ]);
      }
    );
  } finally {
    restore();
  }
});

test("requests and records trusted Router TEE verification", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const restore = mockFetch((url, init) => {
    assertPath(url, "/v1/chat/completions");
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return jsonResponse(
      {
        choices: [{ message: { content: "ok" } }],
        id: "fallback-chat-id",
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "req-tee",
          tee_verified: true,
        },
      },
      {
        headers: { "ZG-Res-Key": "chat-from-header" },
      }
    );
  });

  try {
    await withEnv(
      {
        LANGCLAW_TEE_INDEPENDENT_VERIFY: "false",
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-tee-ok.test/v1",
      },
      async () => {
        const result = await chatCompletion({
          messages: [{ content: "hello", role: "user" }],
          model: "chat-model",
          verify_tee: true,
        });

        assert.equal(requestBody?.verify_tee, true);
        assert.equal(result.trace?.chatId, "chat-from-header");
        assert.deepEqual(result.teeVerification, {
          chatId: "chat-from-header",
          requested: true,
          routerVerified: true,
          status: "router-verified",
        });
      }
    );
  } finally {
    restore();
  }
});

test("fails closed when requested Router TEE verification is false", async () => {
  const restore = mockFetch(() =>
    jsonResponse({
      choices: [{ message: { content: "ok" } }],
      x_0g_trace: {
        provider: "0xprovider",
        request_id: "req-tee-false",
        tee_verified: false,
      },
    })
  );

  try {
    await withEnv(
      {
        OG_COMPUTE_API_KEY: "test-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-tee-false.test/v1",
      },
      async () => {
        await assert.rejects(
          () =>
            chatCompletion({
              messages: [{ content: "hello", role: "user" }],
              model: "chat-model",
              verify_tee: true,
            }),
          (error: unknown) => {
            assert.ok(error instanceof RouterHttpError);
            assert.equal(error.status, 502);
            assert.equal(error.type, "tee_verification_error");

            return true;
          }
        );
      }
    );
  } finally {
    restore();
  }
});

test("TEE verification defaults on and can be disabled by env or request", async () => {
  await withEnv({ LANGCLAW_TEE_VERIFY_DEFAULT: undefined }, () => {
    assert.equal(shouldRequestTeeVerification(), true);
    assert.equal(shouldRequestTeeVerification(false), false);
  });
  await withEnv({ LANGCLAW_TEE_VERIFY_DEFAULT: "false" }, () => {
    assert.equal(shouldRequestTeeVerification(), false);
    assert.equal(shouldRequestTeeVerification("true"), true);
  });
});

test("maps Router HTTP errors and preserves Retry-After", async () => {
  const statuses = [401, 402, 429, 502, 503];

  for (const status of statuses) {
    const restore = mockFetch(() =>
      jsonResponse(
        {
          error: {
            code: `code-${status}`,
            message: `router error ${status}`,
            type: "router_error",
          },
          request_id: `req-${status}`,
        },
        {
          headers: status === 429 ? { "Retry-After": "7" } : undefined,
          status,
        }
      )
    );

    try {
      await withEnv(
        {
          OG_COMPUTE_API_KEY: "test-key",
          OG_COMPUTE_ENABLED: "true",
          OG_COMPUTE_ROUTER_URL: `https://router-error-${status}.test/v1`,
        },
        async () => {
          await assert.rejects(
            () =>
              chatCompletion({
                messages: [{ content: "hello", role: "user" }],
                model: "chat-model",
              }),
            (error: unknown) => {
              assert.ok(error instanceof RouterHttpError);
              assert.equal(error.status, status);
              assert.equal(error.code, `code-${status}`);
              assert.equal(error.requestId, `req-${status}`);

              if (status === 429) {
                assert.equal(error.retryAfter, "7");
              }

              return true;
            }
          );
        }
      );
    } finally {
      restore();
    }
  }
});
