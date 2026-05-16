# Langclaw Backend

Node.js HTTP API (`signalgraph-backend`) for Langclaw and **SignalGraph**: agent workflows, 0G integrations, Supabase persistence, usage billing, and OpenAI-compatible 0G Compute proxy.

**Platform overview:** [../README.md](../README.md)

## Responsibilities

- **SignalGraph** — `runSignalGraphWorkflow(topic)` via `POST /api/discover` and `/api/discover/stream`
- **Chat** — `POST /api/chat/stream`, session sync to Supabase
- **Account** — wallet auth, API keys (HMAC), memory, automation, usage ledger
- **0G** — Compute Router proxy (`/v1/*`), Storage uploads, Chain registry calls
- **On-chain tools** — optional Alchemy, Dune, DeFiLlama, etc.

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Default: **http://localhost:3001**

```bash
curl http://localhost:3001/health
```

Production:

```bash
npm run build && npm start
```

## HTTP routes

Defined in [`src/server.ts`](src/server.ts):

| Area | Endpoints |
| ---- | --------- |
| Health | `GET /health` |
| Research | `POST /api/discover`, `POST /api/discover/stream` |
| Chat | `POST /api/chat/stream`, `POST /api/chat/sessions` |
| Memory | `POST /api/memory`, `POST /api/memory/settings` |
| API keys | `POST /api/api-keys` |
| Usage | `POST /api/usage/balance`, `quote`, `deposit/verify`, `withdraw/request` |
| Automation | `POST /api/automation/*`, webhooks, Telegram |
| 0G proxy | `GET/POST /v1/*`, `GET/POST /api/0g/*` |

Full request/response shapes: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md).

## SignalGraph + OpenClaw

OpenClaw runs reasoning steps (`openclaw agent --json`); discovery and provider calls stay in TypeScript.

```text
runSignalGraphWorkflow(topic)
  → Planner (OpenClaw)
  → Discovery (TS: X/Brave, GitHub, Tavily, HackQuest)
  → Source normalizer (TS)
  → Trend scorer (OpenClaw)
  → Evidence packager (OpenClaw)
  → Verifier (OpenClaw)
  → Final conclusion (0G Compute → OpenClaw → fallback)
  → 0G Storage upload → SignalGraphRegistry anchor
```

Skills: [`openclaw/skills/`](openclaw/skills/) — see [`openclaw/README.md`](openclaw/README.md).

X discovery defaults to Brave (`X_DISCOVERY_PROVIDER=brave`). Use `x-api` only with `X_BEARER_TOKEN` and credits.

### OpenClaw install (optional, recommended for demos)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
openclaw doctor
```

Env (see `.env.example`):

```bash
OPENCLAW_ENABLED=true
OPENCLAW_WORKFLOW_ENABLED=true
OPENCLAW_AI_SYNTHESIS=true
```

## Environment

Copy [`.env.example`](.env.example). Minimum for a useful dev server:

| Variable | Purpose |
| -------- | ------- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Persistence |
| `LANGCLAW_API_KEY_PEPPER` | API key hashing |
| `OG_COMPUTE_API_KEY`, `OG_COMPUTE_ENABLED` | Model proxy |
| `CORS_ORIGIN` | Frontend origin (default `http://localhost:3000`) |

SignalGraph providers: `BRAVE_SEARCH_API_KEY`, `GITHUB_TOKEN`, `TAVILY_API_KEY`, …

0G proof: `OG_STORAGE_*`, `OG_CHAIN_*`, `SIGNALGRAPH_REGISTRY_ADDRESS`

Billing: `LANGCLAW_USAGE_VAULT_ADDRESS` — deploy from [`../contracts`](../contracts/README.md)

## Supabase

Apply migrations under [`supabase/migrations/`](supabase/migrations/). Clients never write directly; the server uses the service role key.

## Smart contracts

| Contract | Deploy | Env |
| -------- | ------ | --- |
| `LangclawUsageVault` | Foundry in [`../contracts`](../contracts/README.md) | `LANGCLAW_USAGE_VAULT_ADDRESS` |
| `SignalGraphRegistry` | `npm run deploy:registry` | `SIGNALGRAPH_REGISTRY_ADDRESS` |

Registry source: [`contracts/SignalGraphRegistry.sol`](contracts/SignalGraphRegistry.sol)

Deposit verification: [`src/lib/usage.ts`](src/lib/usage.ts) → `POST /api/usage/deposit/verify`

Vault spec: [`docs/SMART_CONTRACT_TEAM_NOTES.md`](docs/SMART_CONTRACT_TEAM_NOTES.md)

## Scripts

```bash
npm run dev          # tsx watch src/server.ts
npm run build        # tsc → dist/
npm start            # node dist/server.js
npm test             # node --test
npm run deploy:registry
```

## Related docs

| File | Description |
| ---- | ----------- |
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Full API |
| [`SIGNALGRAPH_BLUEPRINT.md`](SIGNALGRAPH_BLUEPRINT.md) | Hackathon blueprint |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | Demo video script |
| [`docs/SMART_CONTRACT_TEAM_NOTES.md`](docs/SMART_CONTRACT_TEAM_NOTES.md) | Vault requirements |
