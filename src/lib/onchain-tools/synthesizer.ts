import { onChainDomainLabels } from "./registry";
import { summarizePlan } from "./planner";
import type {
  OnChainPlan,
  OnChainToolFinalPayload,
  OnChainToolResult,
} from "./types";

export function synthesizeOnChainAnswer({
  plan,
  results,
}: {
  plan: OnChainPlan;
  results: OnChainToolResult[];
}): OnChainToolFinalPayload {
  const successful = results.filter((result) => result.status === "success");
  const failed = results.filter((result) => result.status === "failed");
  const domains = Array.from(new Set(results.map((result) => result.domain)));
  const domainText = domains.map((domain) => onChainDomainLabels[domain]).join(", ");
  const title = titleFor(plan.intent);
  const bullets = buildBullets(results);
  const answer =
    successful.length > 0
      ? `I ran ${results.length} on-chain tools across ${domainText || "selected domains"} for ${plan.chain}. ${successful.length} tools returned usable data.`
      : `I tried ${results.length} on-chain tools for ${plan.chain}, but no provider returned usable data.`;

  return {
    answer,
    bullets,
    caveat: buildCaveat(failed),
    generatedAt: new Date().toISOString(),
    plan: summarizePlan(plan),
    recommendation: buildRecommendation(plan.intent, successful, failed),
    title,
    tools: results,
  };
}

export function formatOnChainAnswer(payload: OnChainToolFinalPayload) {
  const lines = [
    `## ${payload.title}`,
    "",
    payload.answer,
    "",
    ...payload.bullets.map((bullet) => `- ${bullet}`),
    "",
    `**Recommendation:** ${payload.recommendation}`,
    "",
    `**Caveat:** ${payload.caveat}`,
  ];

  return lines.filter(Boolean).join("\n");
}

function titleFor(intent: string) {
  if (intent === "wallet") {
    return "On-chain wallet intelligence";
  }

  if (intent === "security") {
    return "On-chain security analysis";
  }

  if (intent === "defi") {
    return "DeFi on-chain intelligence";
  }

  if (intent === "trading-signal") {
    return "Trading signal analysis";
  }

  return "On-chain token intelligence";
}

function buildBullets(results: OnChainToolResult[]) {
  const useful = results.slice(0, 8).map((result) => {
    const status = result.status === "success" ? "OK" : "Issue";
    const source = result.sourceUrl ? ` Source: ${result.sourceUrl}` : "";

    return `${status}: ${result.title} (${result.provider}) - ${result.summary}${source}`;
  });

  return useful.length ? useful : ["No tool output was available."];
}

function buildRecommendation(
  intent: string,
  successful: OnChainToolResult[],
  failed: OnChainToolResult[]
) {
  if (!successful.length) {
    return "Do not make a decision from this run. Add a token address, wallet address, chain, or configured provider query and run it again.";
  }

  if (intent === "trading-signal") {
    return "Use this as analysis only. Confirm liquidity, taxes, holder flow, and security flags before any manual trading decision.";
  }

  if (intent === "security") {
    return "Prioritize high-risk flags first. Treat clean results as preliminary until verified with a second source.";
  }

  if (failed.length) {
    return "Use the successful provider data, then rerun after fixing the failed provider configuration for fuller coverage.";
  }

  return "Use these source-backed results as a starting point for deeper manual review.";
}

function buildCaveat(failed: OnChainToolResult[]) {
  if (!failed.length) {
    return "This is analysis-only. Langclaw did not sign, send, swap, buy, sell, or execute any transaction.";
  }

  const providers = Array.from(new Set(failed.map((result) => result.provider))).join(", ");

  return `This is analysis-only and ${failed.length} tool(s) failed or lacked inputs. Affected providers: ${providers}. Langclaw did not sign, send, swap, buy, sell, or execute any transaction.`;
}
