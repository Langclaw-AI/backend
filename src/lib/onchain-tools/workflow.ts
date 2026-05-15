import { executeOnChainPlan } from "./executor";
import { planOnChainTools, summarizePlan } from "./planner";
import {
  formatOnChainAnswer,
  synthesizeOnChainAnswer,
} from "./synthesizer";
import type {
  OnChainContextMessage,
  OnChainToolCallEvent,
  OnChainToolFinalPayload,
  OnChainToolResult,
} from "./types";

export async function runOnChainToolWorkflow({
  context,
  message,
  onToolCall,
  onToolPlan,
  onToolResult,
  signal,
}: {
  context: OnChainContextMessage[];
  message: string;
  onToolCall?: (event: OnChainToolCallEvent) => void | Promise<void>;
  onToolPlan?: (plan: ReturnType<typeof summarizePlan>) => void | Promise<void>;
  onToolResult?: (event: OnChainToolResult) => void | Promise<void>;
  signal?: AbortSignal;
}): Promise<{
  content: string;
  payload: OnChainToolFinalPayload;
}> {
  const plan = planOnChainTools({ context, message });
  await onToolPlan?.(summarizePlan(plan));
  const results = await executeOnChainPlan({
    onToolCall,
    onToolResult,
    plan,
    signal,
  });
  const payload = synthesizeOnChainAnswer({ plan, results });

  return {
    content: formatOnChainAnswer(payload),
    payload,
  };
}
