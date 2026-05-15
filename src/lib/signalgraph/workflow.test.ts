import assert from "node:assert/strict";
import test from "node:test";

import { synthesizeFinalAnswerWithZeroGCompute } from "./zero-g-compute";
import {
  buildConclusionSignal,
  buildWorkflowProgressEvent,
} from "./workflow";
import type { SourceCard } from "./types";
import { jsonResponse, mockFetch, withEnv } from "../../test/helpers";

test("progress events include standardized timing fields", () => {
  const event = buildWorkflowProgressEvent(
    {
      agent: "Planner Agent",
      pendingSummary: "Waiting",
      skill: "openclaw/skills/planner.md",
      stepId: "planner",
    },
    "complete",
    "Planner completed.",
    {
      execution: "typescript-tool",
      model: "planner-model",
    }
  );

  assert.equal(event.stepId, "planner");
  assert.equal(event.agent, "Planner Agent");
  assert.equal(event.skill, "openclaw/skills/planner.md");
  assert.equal(event.status, "complete");
  assert.equal(event.summary, "Planner completed.");
  assert.equal(event.execution, "typescript-tool");
  assert.equal(event.model, "planner-model");
  assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(event.startedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  assert.match(event.completedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof event.durationMs, "number");
});

test("final conclusion signals keep sourceId and add sourceIds", () => {
  const source: SourceCard = {
    excerpt: "Evidence",
    id: "source-1",
    provider: "GitHub",
    title: "Repo evidence",
    type: "github_repo",
    url: "https://example.test/repo",
  };

  assert.deepEqual(
    buildConclusionSignal("Builder signal", source, "fallback"),
    {
      label: "Builder signal",
      sourceId: "source-1",
      sourceIds: ["source-1"],
      text: "Repo evidence",
    }
  );
});

test("final answer 0G compute proof includes requested and used model metadata", async () => {
  const restore = mockFetch((url) => {
    assert.equal(new URL(url).pathname, "/v1/models");

    return jsonResponse({
      data: [
        {
          id: "agent-model",
          pricing: { completion: "1", prompt: "1" },
        },
      ],
    });
  });

  try {
    await withEnv(
      {
        OG_COMPUTE_ENABLED: "false",
        OG_COMPUTE_MODEL: "default-chat",
        OG_COMPUTE_ROUTER_URL: "https://router-workflow-model.test/v1",
      },
      async () => {
        const result = await synthesizeFinalAnswerWithZeroGCompute({
          agentOutputs: {},
          errors: [],
          requestedModel: "agent-model",
          runtime: "typescript",
          sources: [],
          steps: [],
          topic: "0G agent research",
        });

        assert.equal(result.meta.requestedModel, "agent-model");
        assert.equal(result.meta.usedModel, "agent-model");
        assert.equal(result.meta.modelHonored, true);
        assert.equal(result.compute.requestedModel, "agent-model");
        assert.equal(result.compute.usedModel, "agent-model");
        assert.equal(result.compute.modelHonored, true);
        assert.equal(result.compute.status, "skipped");
      }
    );
  } finally {
    restore();
  }
});

test("final answer compute requests TEE verification and records proof metadata", async () => {
  let chatBody: Record<string, unknown> | undefined;
  const restore = mockFetch((url, init) => {
    const path = new URL(url).pathname;

    if (path === "/v1/models") {
      return jsonResponse({
        data: [
          {
            id: "agent-tee-model",
            pricing: { completion: "1", prompt: "1" },
          },
        ],
      });
    }

    assert.equal(path, "/v1/chat/completions");
    chatBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return jsonResponse(
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "TEE proof is enabled.",
                bullets: ["Router verification requested."],
                caveat: "Test response.",
                generatedBy: "Final Conclusion Agent",
                recommendation: "Keep verification enabled.",
                title: "Verified answer",
              }),
            },
          },
        ],
        id: "completion-id",
        usage: {
          completion_tokens: 5,
          prompt_tokens: 7,
          total_tokens: 12,
        },
        x_0g_trace: {
          billing: { total_cost: "12" },
          provider: "0xprovider",
          request_id: "req-agent-tee",
          tee_verified: true,
        },
      },
      {
        headers: { "ZG-Res-Key": "agent-chat-id" },
      }
    );
  });

  try {
    await withEnv(
      {
        LANGCLAW_TEE_INDEPENDENT_VERIFY: "false",
        OG_COMPUTE_API_KEY: "router-key",
        OG_COMPUTE_ENABLED: "true",
        OG_COMPUTE_ROUTER_URL: "https://router-workflow-tee.test/v1",
      },
      async () => {
        const result = await synthesizeFinalAnswerWithZeroGCompute({
          agentOutputs: {},
          errors: [],
          requestedModel: "agent-tee-model",
          runtime: "typescript",
          sources: [],
          steps: [],
          topic: "0G verified research",
        });

        assert.equal(chatBody?.verify_tee, true);
        assert.equal(result.compute.status, "used");
        assert.equal(result.compute.chatId, "agent-chat-id");
        assert.equal(result.compute.teeVerified, true);
        assert.deepEqual(result.compute.teeVerification, {
          chatId: "agent-chat-id",
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
