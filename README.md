# SignalGraph

SignalGraph is a verifiable multi-agent trend research engine for X-native teams.

Users enter one topic. SignalGraph discovers X posts, GitHub repositories, documentation pages, and HackQuest hackathon or project pages automatically. Coordinated AI agents extract signals, rank trends, write a research brief, upload the evidence bundle to 0G Storage when enabled, and anchor the final brief hash on 0G Chain when a registry contract is configured.

## One Sentence Description

SignalGraph turns one topic into live X, GitHub, Docs, and HackQuest signals through coordinated AI agents and 0G-backed evidence memory.

## Problem

Public trend research is noisy and hard to verify.

Builders often make product decisions from scattered posts, repo activity, docs, and hackathon pages. They need a faster way to find useful signals. They also need proof for the sources behind each recommendation.

## Solution

SignalGraph runs a structured research workflow:

1. The user enters one topic.
2. The OpenClaw runtime adapter routes the topic through specialized skills.
3. The Planner Agent creates live X, GitHub, Docs, and HackQuest search queries.
4. The Discovery Agent finds live sources through server-side provider tools.
5. The Source Agent extracts source metadata and excerpts.
6. The Trend Agent groups and scores signals.
7. The Evidence Agent stores the evidence bundle on 0G Storage.
8. The Verifier Agent checks claim support and prepares proof fields.
9. The Final Conclusion Agent writes the final answer through 0G Compute Router when enabled, then OpenClaw AI fallback.
10. The 0G Storage Commit uploads the canonical evidence bundle.
11. The 0G Chain Anchor registers the final brief hash and storage URI.

## Why 0G

SignalGraph needs persistent memory, verifiable evidence, and AI-native infrastructure.

0G fits this because the hackathon Track 1 focuses on agent frameworks, specialized skills, data-processing pipelines, 0G Compute, and 0G Storage for state persistence and long-context memory.

## Architecture

```text
User
  -> API Client
  -> SignalGraph Backend API
  -> OpenClaw Runtime Adapter
  -> Planner Agent
  -> Discovery Agent
  -> Source Agent
  -> Trend Agent
  -> Evidence Agent
  -> Verifier Agent
  -> Final Conclusion Agent
  -> 0G Compute Router
  -> 0G Storage
  -> 0G Chain
  -> Verification Panel
```

## OpenClaw Native Workflow

SignalGraph uses OpenClaw as the agent reasoning and orchestration layer.

OpenClaw is not a raw provider API caller. The backend keeps provider tools server-side for X discovery, GitHub API, Tavily or Brave Search, and HackQuest. OpenClaw owns the reasoning steps for Planner, Trend Scorer, Evidence Packager, Verifier, and Final Conclusion. Each of those steps runs through `openclaw agent --json` with a separate session id when OpenClaw is enabled. Discovery, source normalization, 0G Storage upload, and 0G Chain anchoring stay in TypeScript so API keys and wallet keys remain server-side.

By default, X discovery uses Brave Search with a `site:x.com` query. Set `X_DISCOVERY_PROVIDER=x-api` only when the official X API has available credits.

The internal workflow entrypoint is:

```text
runSignalGraphWorkflow(topic)
```

The public API stays stable:

```text
POST /api/discover
```

The streaming discovery API uses NDJSON progress events:

```text
POST /api/discover/stream
```

The response includes:

```ts
orchestration: {
  runtime: "openclaw" | "typescript";
  steps: Array<{
    agent: string;
    skill: string;
    status: "complete" | "failed";
    summary: string;
    execution?: "openclaw-agent" | "typescript-tool" | "0g-compute" | "0g-storage" | "0g-chain" | "deterministic-fallback";
    model?: string;
    sessionId?: string;
    error?: string;
  }>;
}

agentOutputs?: {
  planner?: {
    summary: string;
    providerPlan: Array<{
      provider: "X" | "GitHub" | "Tavily" | "HackQuest";
      query: string;
      purpose: string;
    }>;
    scoringFocus: string[];
  };
  trend?: {
    summary: string;
    topTrend: string;
    score: number;
    rankedTrends: Array<{
      label: string;
      score: number;
      why: string;
      sourceIds: string[];
    }>;
  };
  evidence?: {
    bundleSummary: string;
    storageStatus: "prepared" | "uploaded" | "skipped" | "failed";
    evidenceUri: string;
    rootHash?: string;
    storageTxHash?: string;
    storageExplorerUrl?: string;
    error?: string;
    claimMap: Array<{
      claim: string;
      sourceIds: string[];
    }>;
  };
  verifier?: {
    verificationSummary: string;
    unsupportedClaims: string[];
    briefHashInput: string;
    storageStatus: "prepared" | "uploaded" | "skipped" | "failed";
    chainStatus: "prepared" | "anchored" | "skipped" | "failed";
    chainTxHash?: string;
    chainExplorerUrl?: string;
    registryAddress?: string;
    error?: string;
  };
}

zeroG?: {
  storage: {
    status: "prepared" | "uploaded" | "skipped" | "failed";
    evidenceUri: string;
    rootHash?: string;
    txHash?: string;
    explorerUrl?: string;
    error?: string;
  };
  chain: {
    status: "prepared" | "anchored" | "skipped" | "failed";
    briefHash: string;
    txHash?: string;
    explorerUrl?: string;
    registryAddress?: string;
    chainId?: number;
    error?: string;
  };
  compute?: {
    status: "used" | "skipped" | "failed";
    model?: string;
    endpoint?: string;
    error?: string;
  };
}

finalConclusion: {
  headline: string;
  summary: string;
  keySignals: Array<{
    label: string;
    text: string;
    sourceId?: string;
  }>;
  recommendation: string;
  qualityNote: string;
  generatedBy: "Final Conclusion Agent";
}

finalAnswer: {
  title: string;
  answer: string;
  bullets: string[];
  recommendation: string;
  caveat: string;
  generatedBy: "Final Conclusion Agent";
}

finalAnswerMeta?: {
  synthesis: "0g-compute" | "openclaw-ai" | "deterministic-fallback";
  execution?: "0g-compute" | "openclaw-agent" | "deterministic-fallback";
  model?: string;
  sessionId?: string;
  transport?: string;
  fallbackFrom?: string;
  error?: string;
}
```

If `OPENCLAW_ENABLED=true` and the OpenClaw CLI responds, the API marks the runtime as `openclaw`. If `OPENCLAW_WORKFLOW_ENABLED=true`, Planner, Trend Scorer, Evidence Packager, and Verifier run through `openclaw agent --json`. If any OpenClaw step fails or returns invalid JSON, SignalGraph keeps the run live with deterministic fallback output and marks that step as `execution: "deterministic-fallback"`.

## Agents

### Planner Agent

Creates the source plan, scoring rubric, and agent task graph.

### Discovery Agent

Finds live X posts, GitHub repositories, documentation pages, and HackQuest hackathon or project pages from one topic.

### Source Agent

Fetches pages, extracts source text, captures metadata, and normalizes inputs.

### Trend Agent

Finds repeated patterns, ranks trends, and explains each score.

### Evidence Agent

Prepares the evidence bundle, claim map, and storage-ready URI. The TypeScript proof layer then uploads the canonical bundle to 0G Storage when `OG_STORAGE_ENABLED=true` and wallet envs are present.

### Synthesis Agent

Writes the final brief with short claims and source-backed reasoning.

### Verifier Agent

Checks claims and prepares the brief hash input. The TypeScript proof layer then calls `SignalGraphRegistry.registerBrief(bytes32,string)` when `OG_CHAIN_ENABLED=true`, `SIGNALGRAPH_REGISTRY_ADDRESS` is set, and the evidence bundle has been uploaded.

### Final Conclusion Agent

Uses 0G Compute Router for the final chat answer when `OG_COMPUTE_ENABLED=true` and `OG_COMPUTE_API_KEY` is set. If 0G Compute is not ready, it falls back to the OpenClaw-connected model, then deterministic text.

## 0G Integration

### 0G Storage

SignalGraph stores:

- Discovered source metadata
- Discovered source excerpts
- Agent run logs
- Final research brief
- Memory snapshot

Implementation:

- `src/lib/signalgraph/zero-g-proof.ts`
- SDK: `@0gfoundation/0g-storage-ts-sdk`
- Default mainnet indexer: `https://indexer-storage-turbo.0g.ai`
- Default mainnet RPC: `https://evmrpc.0g.ai`

### 0G Chain

SignalGraph anchors:

- Brief hash
- Evidence storage URI
- Creator wallet
- Timestamp

Implementation:

- Contract: `contracts/SignalGraphRegistry.sol`
- Deploy command: `npm run deploy:registry`
- Runtime call: `registerBrief(bytes32 briefHash, string storageUri)`

### 0G Compute Router

SignalGraph uses 0G Compute Router for final-answer inference when enabled. The Router uses an OpenAI-compatible `/v1/chat/completions` endpoint, so the backend calls it directly with `OG_COMPUTE_API_KEY` and `OG_COMPUTE_MODEL`.

Model selection comes from the live Router catalog. Use `GET /api/0g/models` for the UI picker. The backend maps model `type` to the matching endpoint, so chat models use chat completions, image models use image generation, and speech models use audio transcription. Request parameters are filtered against each model's `supported_parameters`.

## Smart Contract

Contract name:

```text
SignalGraphRegistry
```

Core function:

```solidity
function registerBrief(bytes32 briefHash, string calldata storageUri) external returns (uint256);
```

Event:

```solidity
event BriefRegistered(
    uint256 indexed briefId,
    address indexed creator,
    bytes32 briefHash,
    string storageUri
);
```

## Demo Flow

The demo fits inside 3 minutes.

1. Show the problem.
2. Enter one topic in the SignalGraph AI chat.
3. Run the OpenClaw-compatible research workflow.
4. Show the OpenClaw skill trace inside the chat answer.
5. Open the generated trend brief.
6. Show the 0G Compute status in the answer details.
7. Show the evidence URI, root hash, and storage transaction when upload is enabled.
8. Show the brief hash, registry address, and chain transaction when anchoring is enabled.

## Local Setup

```bash
npm install
npm run dev
```

The development server listens on `http://localhost:3000` by default. You can check it with:

```bash
curl http://localhost:3000/health
```

For a production-style run:

```bash
npm run build
npm start
```

## OpenClaw CLI Setup

SignalGraph can run without OpenClaw because every agent step has a deterministic fallback. For the hackathon demo, install and verify OpenClaw so the Planner, Trend Scorer, Evidence Packager, Verifier, and Final Conclusion steps can run through `openclaw agent --json`.

Install OpenClaw on macOS, Linux, or WSL2:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Run onboarding and start the Gateway:

```bash
openclaw onboard --install-daemon
```

Verify the CLI and Gateway:

```bash
openclaw --version
openclaw doctor
openclaw gateway status
```

Run a JSON smoke test:

```bash
openclaw agent \
  --session-id signalgraph-readme-smoke \
  --message "Return JSON only: {\"ok\":true,\"summary\":\"OpenClaw is ready\"}" \
  --thinking low \
  --timeout 60 \
  --json
```

If the command prints valid JSON, SignalGraph can call OpenClaw from the backend API route.

Use these environment values in `.env` or `.env.local`:

```bash
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

`OPENCLAW_MODEL` is optional. Leave it empty to use the model configured in OpenClaw. Set it only when you want SignalGraph to force a specific OpenClaw model for agent steps.

More detail:

- OpenClaw install docs: https://docs.openclaw.ai/install
- OpenClaw getting started: https://docs.openclaw.ai/start/getting-started
- Project skill workspace: `openclaw/skills`

## Environment Variables

```bash
X_BEARER_TOKEN=
X_DISCOVERY_PROVIDER=brave
GITHUB_TOKEN=
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENCLAW_ENABLED=true
OPENCLAW_CLI_PATH=openclaw
OPENCLAW_WORKFLOW_ENABLED=true
OPENCLAW_STEP_TIMEOUT_SECONDS=60
OPENCLAW_AI_SYNTHESIS=true
OPENCLAW_AGENT_SESSION_ID=signalgraph-final-answer
OPENCLAW_AGENT_TIMEOUT_SECONDS=90
OPENCLAW_AGENT_THINKING=low
OPENCLAW_MODEL=
OPENAI_API_KEY=
OG_COMPUTE_ENABLED=true
OG_COMPUTE_ROUTER_URL=https://router-api.0g.ai/v1
OG_COMPUTE_MODEL=0GM-1.0-35B-A3B
OG_DIRECT_CHAT_MODEL=0GM-1.0-35B-A3B
OG_COMPUTE_API_KEY=
OG_COMPUTE_TIMEOUT_SECONDS=90
LANGCLAW_USAGE_MARKUP_BPS=3000
LANGCLAW_USAGE_VAULT_ADDRESS=
OG_STORAGE_ENABLED=true
OG_STORAGE_INDEXER_RPC=https://indexer-storage-turbo.0g.ai
OG_STORAGE_RPC_URL=https://evmrpc.0g.ai
OG_STORAGE_PRIVATE_KEY=
OG_PRIVATE_KEY=
OG_CHAIN_ENABLED=true
OG_CHAIN_RPC_URL=https://evmrpc.0g.ai
OG_CHAIN_ID=16661
OG_CHAIN_EXPLORER_URL=https://chainscan.0g.ai
OG_STORAGE_EXPLORER_URL=https://storagescan.0g.ai
OG_RPC_URL=
SIGNALGRAPH_REGISTRY_ADDRESS=
```

## Supabase Persistence

When a client sends a signed wallet session and `SUPABASE_SERVICE_ROLE_KEY` is configured, the backend syncs chat history to Supabase through:

```text
POST /api/chat/sessions
```

Clients never write directly to chat tables. The server verifies the wallet signature, then writes sessions and messages with the Supabase service role key.

Apply the database schema from:

```bash
supabase/migrations/20260514150000_langclaw_chat_memory.sql
```

The schema enables RLS on all Langclaw tables. No public table policies are added because chat writes go through the server route.

Deploy the registry contract after the wallet has 0G mainnet tokens:

```bash
npm run deploy:registry
```

The deploy script loads `.env.local` and `.env`. Copy the printed `SIGNALGRAPH_REGISTRY_ADDRESS` into the active env file, then restart the backend.

## Reviewer Notes

This section will include:

- Demo URL
- Demo video link
- Contract address
- Explorer link
- Sample research run
- Test wallet notes

## Roadmap

### MVP

- Topic-only Auto Discovery
- Live X, GitHub, Docs, and HackQuest source cards
- Agent timeline
- Trend brief
- 0G Compute final-answer inference
- 0G Storage evidence bundle upload
- 0G Chain brief hash anchoring
- Verification panel

### Next

- Run history
- Better source cards
- Team workspace
- Public share page for verified briefs

## Sources

- HackQuest hackathon directory: https://www.hackquest.io/hackathons
- 0G APAC Hackathon: https://www.hackquest.io/hackathons/0G-APAC-Hackathon
- 0G Documentation: https://docs.0g.ai/
- 0G Compute Router: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
- 0G Storage overview: https://0g.ai/blog/0g-storage
