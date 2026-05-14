import { buildFinalAnswerPrompt, parseFinalAnswer } from "./openclaw-ai";
import { readPositiveInt, sanitizeError } from "./openclaw-runner";
import type {
  AgentOutputs,
  FinalAnswer,
  FinalAnswerMeta,
  OrchestrationRuntime,
  OrchestrationStep,
  ProviderError,
  SourceCard,
  ZeroGComputeProof,
} from "./types";

type ZeroGComputeInput = {
  topic: string;
  sources: SourceCard[];
  errors: ProviderError[];
  runtime: OrchestrationRuntime;
  steps: OrchestrationStep[];
  agentOutputs?: AgentOutputs;
};

type ZeroGComputeResult = {
  finalAnswer?: FinalAnswer;
  meta: FinalAnswerMeta;
  compute: ZeroGComputeProof;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: unknown;
  };
};

const defaultRouterUrl = "https://router-api-testnet.integratenetwork.work/v1";
const defaultModel = "qwen/qwen-2.5-7b-instruct";

export async function synthesizeFinalAnswerWithZeroGCompute(
  input: ZeroGComputeInput
): Promise<ZeroGComputeResult> {
  const endpoint = normalizeRouterUrl(
    process.env.OG_COMPUTE_ROUTER_URL || defaultRouterUrl
  );
  const model = process.env.OG_COMPUTE_MODEL?.trim() || defaultModel;
  const apiKey = process.env.OG_COMPUTE_API_KEY?.trim();

  if (process.env.OG_COMPUTE_ENABLED !== "true") {
    return skippedCompute(
      model,
      endpoint,
      "OG_COMPUTE_ENABLED is not true."
    );
  }

  if (!apiKey) {
    return skippedCompute(
      model,
      endpoint,
      "OG_COMPUTE_API_KEY is empty."
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInt(process.env.OG_COMPUTE_TIMEOUT_SECONDS, 90) * 1000
  );

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are SignalGraph's Final Conclusion Agent. Return only valid JSON.",
          },
          {
            role: "user",
            content: buildFinalAnswerPrompt(input),
          },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | ChatCompletionResponse
      | null;

    if (!response.ok) {
      const errorMessage =
        readString(payload?.error?.message) ||
        `0G Compute Router returned HTTP ${response.status}.`;

      throw new Error(errorMessage);
    }

    const text = readString(payload?.choices?.[0]?.message?.content);
    const finalAnswer = parseFinalAnswer(text);

    if (!finalAnswer) {
      throw new Error("0G Compute Router did not return a valid finalAnswer JSON object.");
    }

    return {
      finalAnswer,
      meta: {
        synthesis: "0g-compute",
        execution: "0g-compute",
        model,
        transport: "0g-compute-router",
      },
      compute: {
        status: "used",
        model,
        endpoint,
      },
    };
  } catch (error) {
    const detail = sanitizeError(
      error instanceof Error ? error.message : String(error)
    );

    return {
      meta: {
        synthesis: "deterministic-fallback",
        execution: "deterministic-fallback",
        model,
        transport: "0g-compute-router",
        error: detail || "0G Compute Router request failed.",
      },
      compute: {
        status: "failed",
        model,
        endpoint,
        error: detail || "0G Compute Router request failed.",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function skippedCompute(
  model: string,
  endpoint: string,
  error: string
): ZeroGComputeResult {
  return {
    meta: {
      synthesis: "deterministic-fallback",
      execution: "deterministic-fallback",
      model,
      transport: "0g-compute-router",
      error,
    },
    compute: {
      status: "skipped",
      model,
      endpoint,
      error,
    },
  };
}

function normalizeRouterUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
