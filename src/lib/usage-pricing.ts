import type { RouterTrace } from "./zero-g/router";
import type { ModelUsageReceipt, ZeroGComputeStatus, ZeroGTokenUsage } from "./signalgraph/types";

export type UsageCostSelection = {
  chargedRawNeuron: string;
  costSource: ModelUsageReceipt["costSource"];
  status: ModelUsageReceipt["status"];
};

export function calculateTokenCostNeuron({
  completionPriceNeuron,
  completionTokens,
  promptPriceNeuron,
  promptTokens,
}: {
  completionPriceNeuron: string;
  completionTokens: number;
  promptPriceNeuron: string;
  promptTokens: number;
}) {
  return (
    BigInt(promptPriceNeuron) * BigInt(Math.max(0, promptTokens)) +
    BigInt(completionPriceNeuron) * BigInt(Math.max(0, completionTokens))
  ).toString();
}

export function selectUsageCost({
  completionPriceNeuron,
  computeStatus,
  promptPriceNeuron,
  reservedNeuron,
  routerTrace,
  tokenUsage,
}: {
  completionPriceNeuron: string;
  computeStatus?: ZeroGComputeStatus;
  promptPriceNeuron: string;
  reservedNeuron: string;
  routerTrace?: RouterTrace;
  tokenUsage?: ZeroGTokenUsage;
}): UsageCostSelection {
  const traceTotalCost = readDecimalString(routerTrace?.billing?.totalCostNeuron);
  const promptTokens = tokenUsage?.promptTokens ?? 0;
  const completionTokens = tokenUsage?.completionTokens ?? 0;
  const hasTraceCost = computeStatus === "used" && traceTotalCost !== "0";
  const hasActualUsage =
    computeStatus === "used" && (promptTokens > 0 || completionTokens > 0);

  if (hasTraceCost) {
    return {
      chargedRawNeuron: traceTotalCost,
      costSource: "router-trace",
      status: "charged",
    };
  }

  if (hasActualUsage) {
    return {
      chargedRawNeuron: calculateTokenCostNeuron({
        completionPriceNeuron,
        completionTokens,
        promptPriceNeuron,
        promptTokens,
      }),
      costSource: "token-estimate",
      status: "charged",
    };
  }

  if (computeStatus === "used") {
    return {
      chargedRawNeuron: reservedNeuron,
      costSource: "reserved-estimate",
      status: "estimated",
    };
  }

  return {
    chargedRawNeuron: "0",
    costSource: "reserved-estimate",
    status: "refunded",
  };
}

export function readUsageMarkupBps(value = process.env.LANGCLAW_USAGE_MARKUP_BPS) {
  const parsed = Number.parseInt(value ?? "3000", 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 3000;
  }

  return Math.min(parsed, 100_000);
}

export function calculateMarkupNeuron(rawCostNeuron: string, markupBps: number) {
  const raw = BigInt(readDecimalString(rawCostNeuron));

  if (raw === 0n || markupBps <= 0) {
    return "0";
  }

  return ((raw * BigInt(markupBps)) / 10_000n).toString();
}

export function applyMarkupNeuron(rawCostNeuron: string, markupBps: number) {
  const raw = BigInt(readDecimalString(rawCostNeuron));
  const markup = BigInt(calculateMarkupNeuron(rawCostNeuron, markupBps));

  return (raw + markup).toString();
}

export function mapUiTokenUsage(tokenUsage?: ZeroGTokenUsage) {
  if (!tokenUsage) {
    return {};
  }

  return {
    inputTokens: tokenUsage.inputTokens ?? tokenUsage.promptTokens,
    outputTokens: tokenUsage.outputTokens ?? tokenUsage.completionTokens,
    reasoningTokens: tokenUsage.reasoningTokens,
    cachedInputTokens: tokenUsage.cachedInputTokens,
    maxTokens: tokenUsage.maxTokens,
    promptTokens: tokenUsage.promptTokens,
    completionTokens: tokenUsage.completionTokens,
    totalTokens: tokenUsage.totalTokens,
  };
}

function readDecimalString(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.trunc(value)) : "0";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return value;
  }

  return "0";
}
