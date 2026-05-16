import { buildFinalAnswerPrompt, parseFinalAnswer } from "./openclaw-ai";
import { sanitizeError } from "./openclaw-runner";
import {
  chatCompletion,
  extractTextContent,
  getDefaultRouterModel,
  getRouterEndpoint,
  hasRouterApiKey,
  isRouterInferenceEnabled,
  resolveRouterModelSelection,
  shouldRequestTeeVerification,
  type RouterModelSelection,
  type RouterTokenUsage,
} from "../zero-g/router";
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
  requestedModel?: unknown;
};

type ZeroGComputeResult = {
  finalAnswer?: FinalAnswer;
  meta: FinalAnswerMeta;
  compute: ZeroGComputeProof;
};

export async function synthesizeFinalAnswerWithZeroGCompute(
  input: ZeroGComputeInput
): Promise<ZeroGComputeResult> {
  const endpoint = getRouterEndpoint();
  const selection = await resolveComputeModelSelection(input.requestedModel);
  const model = selection.usedModel;

  if (!isRouterInferenceEnabled()) {
    return skippedCompute(
      selection,
      endpoint,
      "OG_COMPUTE_ENABLED is not true."
    );
  }

  if (!hasRouterApiKey()) {
    return skippedCompute(
      selection,
      endpoint,
      "OG_COMPUTE_API_KEY is empty."
    );
  }

  try {
    const result = await chatCompletion({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are Langclaw's Final Conclusion Agent. Return only valid JSON.",
        },
        {
          role: "user",
          content: buildFinalAnswerPrompt(input),
        },
      ],
      temperature: 0.2,
      verify_tee: shouldRequestTeeVerification(),
    });
    const text = extractTextContent(result.data);
    const finalAnswer = parseFinalAnswer(text);

    if (!finalAnswer) {
      throw new Error("0G Compute Router did not return a valid finalAnswer JSON object.");
    }

    return {
      finalAnswer,
      meta: {
        synthesis: "0g-compute",
        execution: "0g-compute",
        fallbackFrom: selection.fallbackFrom,
        model,
        modelHonored: selection.modelHonored,
        requestedModel: selection.requestedModel,
        transport: "0g-compute-router",
        usedModel: model,
      },
      compute: {
        status: "used",
        fallbackFrom: selection.fallbackFrom,
        model,
        modelHonored: selection.modelHonored,
        endpoint,
        chatId: result.trace?.chatId,
        requestId: result.trace?.requestId,
        requestedModel: selection.requestedModel,
        provider: result.trace?.provider,
        teeVerified: result.trace?.teeVerified,
        teeVerification: result.teeVerification,
        usedModel: model,
        usage: toZeroGUsage(result.usage),
        billing: result.trace?.billing?.totalCostNeuron
          ? {
              inputCostNeuron: result.trace.billing.inputCostNeuron,
              outputCostNeuron: result.trace.billing.outputCostNeuron,
              totalCostNeuron: result.trace.billing.totalCostNeuron,
              source: "router-trace",
            }
          : undefined,
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
        fallbackFrom: selection.fallbackFrom,
        model,
        modelHonored: selection.modelHonored,
        requestedModel: selection.requestedModel,
        transport: "0g-compute-router",
        error: detail || "0G Compute Router request failed.",
        usedModel: model,
      },
      compute: {
        status: "failed",
        fallbackFrom: selection.fallbackFrom,
        model,
        modelHonored: selection.modelHonored,
        endpoint,
        error: detail || "0G Compute Router request failed.",
        requestedModel: selection.requestedModel,
        usedModel: model,
      },
    };
  }
}

async function resolveComputeModelSelection(requestedModel?: unknown) {
  const fallbackRequested =
    (requestedModel ?? process.env.OG_COMPUTE_MODEL?.trim()) || undefined;

  return resolveRouterModelSelection({
    requestedModel: fallbackRequested,
    service: "chat",
  }).catch(
    (): RouterModelSelection => {
      const requested =
        typeof requestedModel === "string" ? requestedModel.trim() : "";
      const usedModel = getDefaultRouterModel("chat");

      return requested
        ? {
            fallbackFrom: requested,
            modelHonored: false,
            requestedModel: requested,
            usedModel,
          }
        : {
            modelHonored: true,
            usedModel,
          };
    }
  );
}

function skippedCompute(
  selection: RouterModelSelection,
  endpoint: string,
  error: string
): ZeroGComputeResult {
  const model = selection.usedModel;

  return {
    meta: {
      synthesis: "deterministic-fallback",
      execution: "deterministic-fallback",
      fallbackFrom: selection.fallbackFrom,
      model,
      modelHonored: selection.modelHonored,
      requestedModel: selection.requestedModel,
      transport: "0g-compute-router",
      error,
      usedModel: model,
    },
    compute: {
      status: "skipped",
      fallbackFrom: selection.fallbackFrom,
      model,
      modelHonored: selection.modelHonored,
      endpoint,
      error,
      requestedModel: selection.requestedModel,
      usedModel: model,
    },
  };
}

function toZeroGUsage(value: RouterTokenUsage | undefined) {
  if (!value) {
    return undefined;
  }

  if (
    value.inputTokens === undefined &&
    value.outputTokens === undefined &&
    value.reasoningTokens === undefined &&
    value.cachedInputTokens === undefined &&
    value.maxTokens === undefined &&
    value.promptTokens === undefined &&
    value.completionTokens === undefined &&
    value.totalTokens === undefined
  ) {
    return undefined;
  }

  return {
    inputTokens: value.inputTokens ?? value.promptTokens,
    outputTokens: value.outputTokens ?? value.completionTokens,
    reasoningTokens: value.reasoningTokens,
    cachedInputTokens: value.cachedInputTokens,
    maxTokens: value.maxTokens,
    promptTokens: value.promptTokens,
    completionTokens: value.completionTokens,
    totalTokens: value.totalTokens,
  };
}
