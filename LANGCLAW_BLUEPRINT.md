# Langclaw Hackathon Blueprint

Langclaw is the recommended project for the 0G APAC Hackathon Track 1.

It is a verifiable multi-agent trend research engine. It helps builders, founders, creators, and ecosystem teams turn noisy X posts, GitHub repos, product docs, and project pages into a clear research brief with a stored evidence trail.

## Final Project Name

Langclaw

## One Sentence Description

Langclaw turns one topic into live X, GitHub, Docs, and HackQuest signals through OpenClaw-compatible agents and 0G-backed evidence memory.

## Positioning

Build Langclaw as an agentic research engine, not a chatbot.

The product does one valuable job:

It tracks public product signals, ranks what matters, explains why it matters, and stores the evidence so other people can verify the brief.

This fits Track 1 because the system shows:

- Agent orchestration
- Specialized agent skills
- Data-processing pipelines
- Long-context research memory
- 0G Storage integration
- Optional 0G Compute Router integration
- Verifiable on-chain proof for generated briefs

## Why This Idea

Personal AI assistants and memory vaults are already crowded. Langclaw avoids that lane.

Langclaw focuses on a sharper problem:

Teams need fast trend research before they build, pitch, post, or invest time.

The current workflow is slow:

- People read X manually.
- They open many GitHub repos.
- They scan docs and product pages.
- They copy claims into notes.
- They lose the source trail.
- They cannot prove where the final brief came from.

Langclaw fixes that with coordinated agents and verifiable evidence storage.

## Target Users

- Hackathon builders
- Startup founders
- Ecosystem growth teams
- Creator teams
- Product researchers
- Developer relations teams
- Web3 project analysts

## Core Use Case

User prompt:

```text
Find the strongest AI x Web3 product trends this week and suggest one project angle for a builder team.
```

Langclaw then:

1. Reads one topic from the user.
2. Discovers live X posts, GitHub repos, docs, and HackQuest pages.
3. Extracts claims, launches, features, metrics, and repeated patterns.
4. Groups signals into trends.
5. Scores each trend by novelty, evidence strength, buildability, and market timing.
6. Writes a short research brief.
7. Stores the evidence bundle on 0G Storage.
8. Anchors the brief hash on 0G Chain.
9. Shows the CID, hash, and verification status in the UI.

## Product Scope

### MVP Input

Use topic-only Auto Discovery.

Supported inputs:

- Topic text

### MVP Output

Each research run produces:

- Top trend summary
- Evidence-backed findings
- Source list
- Build opportunity
- Risk notes
- Suggested project angle
- Evidence bundle CID
- Brief hash
- 0G Explorer link

## Agent System

### 1. Planner Agent

Role:

- Reads the research objective.
- Routes the workflow through OpenClaw-compatible skills.
- Defines the source plan.
- Splits work across agents.
- Sets scoring weights.

Output:

- Research plan
- Source queue
- Scoring rubric

### 2. Discovery Agent

Role:

- Runs live discovery through TypeScript provider tools.
- Finds X posts, GitHub repos, docs pages, and HackQuest pages.
- Returns provider errors when one source fails.

Output:

- Raw provider results
- Live source URLs
- Provider issue list

### 3. Source Agent

Role:

- Fetches pages.
- Extracts title, author, date, visible text, repo metadata, and links.
- Normalizes source data.

Output:

- Source cards
- Raw excerpts
- Metadata

### 4. Trend Agent

Role:

- Finds repeated patterns.
- Detects fresh product angles.
- Groups related signals.
- Scores each trend.

Scoring factors:

- Novelty
- Evidence strength
- Buildability
- Demo potential
- 0G fit
- Market relevance

Output:

- Ranked trend list
- Score explanation

### 5. Evidence Agent

Role:

- Creates the evidence bundle.
- Stores raw source metadata, excerpts, run logs, and final brief.
- Uploads the bundle to 0G Storage.

Output:

- Evidence JSON
- Storage CID or root hash
- Storage explorer link if available

### 6. Synthesis Agent

Role:

- Writes the final brief.
- Keeps claims short.
- Links every key claim to evidence.
- Writes an action-focused recommendation.

Output:

- Final trend brief
- Project angle
- Demo-ready summary

### 7. Verifier Agent

Role:

- Checks that each major claim has source support.
- Computes the brief hash.
- Calls the contract to anchor the hash.
- Marks unsupported claims before final output.

Output:

- Verification report
- Brief hash
- Contract transaction hash
- Explorer link

### 8. Final Conclusion Agent

Role:

- Reads all agent outputs.
- Writes the final conclusion.
- Highlights key signals from live sources.
- Includes provider quality notes.

Output:

- Final conclusion
- Key source signals
- Recommended framing
- Quality note

## Technical Architecture

```text
User
  -> API Client
  -> Langclaw Backend API
  -> OpenClaw Runtime Adapter
  -> Planner Agent
  -> Discovery Agent
  -> Source Agent
  -> Trend Agent
  -> Evidence Agent
  -> Synthesis Agent
  -> Verifier Agent
  -> Final Conclusion Agent
  -> 0G Storage
  -> 0G Chain
  -> Verification Panel
```

## Recommended Stack

### Backend

- Node.js HTTP API
- TypeScript
- OpenClaw runtime adapter for Track 1 alignment
- TypeScript provider tools for live discovery
- Brave Search-backed X discovery by default
- Brave Search fallback for Docs and HackQuest web search
- 0G Compute Router for inference if setup is ready

### Storage

- 0G Storage for evidence bundles
- Local JSON fallback only for development

### Chain

- Solidity smart contract on 0G
- Stores brief hash, storage URI, creator wallet, and timestamp

## 0G Integration Plan

### 0G Storage

Use 0G Storage for the core proof.

Store:

- Evidence bundle
- Source metadata
- Agent run logs
- Final brief
- Memory snapshot

Why it matters:

- The final brief becomes reproducible.
- Judges can inspect the source trail.
- The product shows real state persistence.
- The architecture matches Track 1 requirements.

### 0G Chain

Deploy a small contract:

```solidity
struct BriefRecord {
    bytes32 briefHash;
    string storageUri;
    address creator;
    uint256 createdAt;
}
```

Core function:

```solidity
function registerBrief(bytes32 briefHash, string calldata storageUri) external;
```

Why it matters:

- The research output has a public proof.
- Users can verify that the stored evidence matches the submitted brief.
- The demo can show a real explorer link.

### 0G Compute Router

Use the Compute Router if setup time allows.

Use it for:

- Agent inference
- Trend scoring
- Brief synthesis

Why it matters:

- It strengthens 0G technical depth.
- It keeps the inference layer aligned with 0G.
- It gives a clean story for decentralized AI execution.

### OpenClaw

Use OpenClaw as the orchestration adapter for Langclaw.

Current integration:

- Define each Langclaw agent as an OpenClaw-compatible skill.
- Route the topic through `runLangclawWorkflow(topic)`.
- Keep raw provider API calls in TypeScript.
- Return a runtime trace to the API response and UI.

Fallback:

- If `OPENCLAW_ENABLED=false`, use the built-in TypeScript runtime.
- If the OpenClaw CLI is missing, keep the run live and mark the runtime as TypeScript.

## Smart Contract Shape

Contract name:

```text
LangclawRegistry
```

Events:

```solidity
event BriefRegistered(
    uint256 indexed briefId,
    address indexed creator,
    bytes32 briefHash,
    string storageUri
);
```

Functions:

```solidity
function registerBrief(bytes32 briefHash, string calldata storageUri) external returns (uint256);
function getBrief(uint256 briefId) external view returns (BriefRecord memory);
```

## Evidence Bundle Shape

```json
{
  "runId": "sg_2026_05_12_001",
  "objective": "Find the strongest AI x Web3 product trends this week.",
  "createdAt": "2026-05-12T15:00:00+07:00",
  "sources": [
    {
      "url": "https://example.com/thread",
      "type": "x_thread",
      "title": "Example thread",
      "capturedAt": "2026-05-12T15:03:00+07:00",
      "excerpts": ["Short claim used in final brief."]
    }
  ],
  "agentOutputs": {
    "planner": {},
    "trend": {},
    "synthesis": {},
    "verifier": {}
  },
  "brief": {
    "title": "AI Agent Swarms for Product Teams",
    "summary": "Short final output.",
    "claims": []
  }
}
```

## UI Screens

### 1. Langclaw AI Chat

Purpose:

- Start a research run.
- Enter one topic.
- Trigger live Auto Discovery.

Elements:

- Assistant welcome message
- Suggested topic prompts
- Chat composer
- Send button

### 2. OpenClaw Skill Trace

Purpose:

- Show orchestration clearly.
- Keep the workflow visible inside the chat answer.

Items:

- Final Conclusion
- Planner created source plan.
- Discovery Agent found live sources.
- OpenClaw Runtime returned a skill trace.
- Trend Agent found 3 trend clusters.
- Evidence Agent uploaded bundle to 0G.
- Verifier Agent anchored hash on-chain.
- Final Conclusion Agent wrote the final answer.

### 3. Trend Brief

Purpose:

- Show the useful result.

Sections:

- Top trend
- Why it matters
- Evidence
- Build opportunity
- Suggested project angle
- Risks

### 4. Verification Panel

Purpose:

- Prove the Web3 layer.

Fields:

- Evidence CID or root hash
- Brief hash
- Contract address
- Transaction hash
- Explorer link
- Verify button

## Demo Flow, 3 Minutes

### 0:00 to 0:20

Say:

```text
Teams waste hours reading noisy public signals before they decide what to build. Langclaw turns X threads, GitHub repos, and docs into a verified trend brief.
```

Show:

- Landing screen
- One-line product statement

### 0:20 to 0:50

Action:

- Enter one topic.
- Send it through the Langclaw AI chat composer.
- Open the OpenClaw skill trace inside the chat answer.

Say:

```text
OpenClaw routes the topic through planner, discovery, source normalization, trend scoring, evidence packaging, and verification skills.
```

Show:

- OpenClaw skill trace starts

### 0:50 to 1:30

Action:

- Show agents completing tasks.

Say:

```text
The Source Agent extracts claims. The Trend Agent ranks patterns. The Synthesis Agent writes a brief. The Verifier Agent checks that important claims have evidence.
```

Show:

- Source cards
- Trend scores
- Claim links

### 1:30 to 2:10

Action:

- Open final brief.

Say:

```text
The output is not a generic summary. It gives one decision-ready trend, evidence, a build angle, and risks.
```

Show:

- Top trend
- Recommended project angle
- Evidence list

### 2:10 to 2:45

Action:

- Open verification panel.
- Show 0G Storage CID.
- Show brief hash.
- Show transaction hash or explorer link.

Say:

```text
Langclaw stores the evidence bundle on 0G Storage and anchors the brief hash on-chain. The team can prove what the agent saw when it wrote the brief.
```

Show:

- CID
- Hash
- Explorer link

### 2:45 to 3:00

Say:

```text
Langclaw is an agentic research layer for X-native teams. It gives them fast strategy, clear evidence, and verifiable AI output.
```

Show:

- Final product name
- GitHub link
- X post link

## MVP Timeline

The current date is May 12, 2026. The submission deadline is May 16, 2026 at 23:59 UTC+8, which is May 16, 2026 at 22:59 WIB.

### Day 1, May 12

Goal:

- Lock scope.
- Create repo structure.
- Build backend API skeleton.
- Draft contract.

Tasks:

- Create Node.js backend app.
- Add research API routes.
- Add static agent trace payload.
- Add registry contract.
- Add sample evidence JSON.

Done when:

- Local backend starts.
- Client can POST one topic.
- Static demo flow works.

### Day 2, May 13

Goal:

- Build the agent pipeline.

Tasks:

- Implement Source Agent.
- Implement Trend Agent.
- Implement Synthesis Agent.
- Implement Verifier Agent.
- Store run output locally.

Done when:

- A research run produces a brief from live discovered sources.
- Each major claim links to at least one source.

### Day 3, May 14

Goal:

- Add 0G integration.

Tasks:

- Upload evidence bundle to 0G Storage.
- Compute brief hash.
- Deploy LangclawRegistry.
- Register one brief on-chain.
- Save contract address and explorer link.

Done when:

- The app shows CID, hash, contract address, and transaction hash.

### Day 4, May 15

Goal:

- Polish the demo.

Tasks:

- Add verification panel.
- Add run history.
- Add source cards.
- Add sample high-quality dataset.
- Add README.
- Add architecture diagram in text.

Done when:

- Demo can run in under 3 minutes.
- README explains how judges can reproduce it.

### Day 5, May 16

Goal:

- Submit cleanly before 22:59 WIB.

Tasks:

- Record demo video.
- Publish public GitHub repo.
- Publish required X post.
- Add screenshots.
- Fill HackQuest fields.
- Submit at least 2 hours before deadline.

Done when:

- HackQuest submission includes repo, video, 0G proof, README, and X post.

## README Sections for Submission

Use this order:

1. Project Overview
2. Problem
3. Solution
4. Why 0G
5. Architecture
6. Agent Workflow
7. 0G Storage Integration
8. 0G Chain Integration
9. Demo Flow
10. Local Setup
11. Environment Variables
12. Contract Address
13. Explorer Links
14. Limitations
15. Roadmap

## HackQuest Submission Draft

### Project Name

Langclaw

### One Sentence Description

Langclaw turns one topic into live X, GitHub, Docs, and HackQuest signals through coordinated AI agents and 0G-backed evidence memory.

### Short Summary

Langclaw helps builders and teams understand fast-moving AI x Web3 trends. Users enter one topic. A coordinated agent workflow discovers live X, GitHub, Docs, and HackQuest sources, ranks trends, writes a decision-ready brief, stores the evidence bundle on 0G Storage, and anchors the final brief hash on 0G Chain.

### Problem

Public trend research is noisy and hard to verify. Teams often make build decisions from scattered posts and repo activity without a clear evidence trail.

### Solution

Langclaw turns public signals into structured, verifiable research. It uses multiple specialized agents for source extraction, trend ranking, synthesis, evidence storage, and verification.

### 0G Components

- 0G Storage for evidence bundles and research memory
- 0G Chain for brief hash anchoring
- 0G Compute Router for agent inference if implemented before submission

## X Post Draft

```text
Introducing Langclaw for the #0GHackathon.

Langclaw is a verifiable multi-agent trend research engine for X-native teams.

Enter one topic.
Agents discover X, GitHub, Docs, and HackQuest signals, rank trends, store evidence on 0G Storage, and anchor the brief hash on-chain.

#BuildOn0G
@0G_labs @0g_CN @0g_Eco @HackQuest_
```

## Main Risks

### X API risk

Mitigation:

- Use provider-specific error states.
- Return partial live results from providers that succeed.
- Keep HackQuest direct directory fetch separate from Tavily search.

### 0G integration time risk

Mitigation:

- Prioritize 0G Storage first.
- Add 0G Chain proof second.
- Add 0G Compute Router only after storage and contract work.

### Scope risk

Mitigation:

- Do not build a full social listening platform.
- Do not build a personal assistant.
- Keep the product focused on one verified research run.

### Claim quality risk

Mitigation:

- Force each key claim to cite a source.
- Mark unsupported output as "hypothesis."
- Keep the brief short.

## Build Priority

Priority 1:

- Research console
- Agent timeline
- Brief output
- Evidence bundle
- 0G Storage proof

Priority 2:

- On-chain hash registry
- Explorer link
- Verification panel

Priority 3:

- 0G Compute Router
- Full OpenClaw CLI workflow execution
- Run history
- Better source cards

## Source Notes

- HackQuest 0G APAC Hackathon page: https://www.hackquest.io/hackathons/0G-APAC-Hackathon
- 0G Compute Router docs: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
- 0G Storage overview from 0G: https://0g.ai/blog/0g-storage
- 0G documentation hub: https://docs.0g.ai/
