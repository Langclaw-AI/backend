import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatWorkflowOptions,
  handleChatStream,
} from "./chat-stream";
import { jsonResponse, mockFetch, readNdjson, withEnv } from "../test/helpers";

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

test("direct chat honors supported body.model and returns metadata", async () => {
  const restore = mockFetch((url) => {
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
  const restore = mockFetch(() => jsonResponse({ data: [] }));

  try {
    await withEnv(
      {
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
