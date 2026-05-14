# SignalGraph OpenClaw Workflow

SignalGraph uses this folder as the OpenClaw skill workspace.

OpenClaw acts as the agent reasoning and orchestration layer. It does not call X, GitHub, Tavily, Brave Search, or HackQuest directly. The Next.js server keeps those provider tools in TypeScript so API keys stay server-side.

SignalGraph reads each local skill file and runs these reasoning steps through `openclaw agent --json`:

- Planner Agent
- Trend Scorer Agent
- Evidence Packager Agent
- Verifier Agent
- Final Conclusion Agent

Discovery and Source Normalizer stay as TypeScript tools. That keeps provider credentials outside the agent prompt while still showing a real OpenClaw-driven workflow.

Current X discovery defaults to Brave Search. The official X API remains available behind `X_DISCOVERY_PROVIDER=x-api`.

The public API calls `runSignalGraphWorkflow(topic)`. That workflow routes the topic through these skills:

1. Planner Skill
2. Discovery Skill
3. Source Normalizer Skill
4. Trend Scorer Skill
5. Evidence Packager Skill
6. Verifier Skill
7. Final Conclusion Skill

Default runtime:

```text
OPENCLAW_ENABLED=true
OPENCLAW_WORKFLOW_ENABLED=true
OPENCLAW_STEP_TIMEOUT_SECONDS=60
OPENCLAW_AI_SYNTHESIS=true
```

With the default setting, SignalGraph probes the OpenClaw CLI, runs the reasoning steps through OpenClaw, returns execution metadata for each step, and asks the OpenClaw-connected model to synthesize the final chat answer when 0G Compute Router is not enabled.

Optional runtime:

```text
OPENCLAW_ENABLED=true
OPENCLAW_CLI_PATH=openclaw
OPENCLAW_WORKFLOW_ENABLED=true
OPENCLAW_STEP_TIMEOUT_SECONDS=60
OPENCLAW_AI_SYNTHESIS=true
OPENCLAW_AGENT_SESSION_ID=signalgraph-final-answer
OPENCLAW_AGENT_TIMEOUT_SECONDS=90
OPENCLAW_AGENT_THINKING=low
OPENCLAW_MODEL=
```

When enabled, SignalGraph probes the OpenClaw CLI. If the CLI responds, the API marks the run as `runtime: "openclaw"`. If the CLI is missing, the API falls back to `runtime: "typescript"` and keeps the run live.

If an OpenClaw step fails, the API still returns deterministic fallback output and marks that step as `execution: "deterministic-fallback"`. The evidence and verifier steps prepare proof fields only. They do not claim that 0G Storage upload or 0G Chain anchoring has happened.

The real 0G work runs after the reasoning steps:

- `src/lib/signalgraph/zero-g-compute.ts` calls 0G Compute Router for final-answer inference when `OG_COMPUTE_ENABLED=true`.
- `src/lib/signalgraph/zero-g-proof.ts` uploads the canonical evidence bundle to 0G Storage when `OG_STORAGE_ENABLED=true`.
- `src/lib/signalgraph/zero-g-proof.ts` anchors the final brief hash through `SignalGraphRegistry` when `OG_CHAIN_ENABLED=true`.

If those envs are missing, the response stays honest and marks the proof as `prepared` or `failed` instead of claiming an upload or chain transaction.
