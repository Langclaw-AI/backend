# Langclaw Backend API Reference

Updated: 15 May 2026

This document covers the public and internal HTTP API exposed by the Langclaw backend.

## Base URL

Local development:

```text
http://localhost:3001
```

Production example:

```text
https://api.langclaw.ai
```

## Response Format

Most endpoints return JSON.

Streaming endpoints return newline-delimited JSON.

```text
Content-Type: application/x-ndjson; charset=utf-8
```

Each line is one complete JSON object.

## Authentication

Langclaw supports two account authentication methods.

### Wallet Session

Wallet auth uses a signed message.

Use this method for dashboard actions, billing-sensitive actions, and API key management.

```json
{
  "wallet": {
    "address": "0xabc...",
    "message": "Login to Langclaw\nAddress: 0xabc...\nTime: 2026-05-15T10:00:00.000Z",
    "signature": "0x..."
  }
}
```

The backend validates:

- The wallet address format.
- The message prefix.
- The address inside the message.
- The timestamp freshness.
- The wallet signature.

### API Key

API keys use a bearer token.

```http
Authorization: Bearer $LANGCLAW_API_KEY
```

API keys can access runtime API and account data for the owner wallet.

API keys cannot create or revoke API keys. API keys also cannot verify deposits or request withdrawals.

## Required Environment Variables

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LANGCLAW_API_KEY_PEPPER=
OG_COMPUTE_ENABLED=true
OG_COMPUTE_API_KEY=
OG_COMPUTE_ROUTER_URL=https://router-api.0g.ai/v1
LANGCLAW_ADMIN_API_KEY=
```

`LANGCLAW_API_KEY_PEPPER` must stay private. The backend stores only HMAC hashes of user API keys.

## Health

### `GET /health`

Checks that the backend process is running.

Response:

```json
{
  "ok": true,
  "service": "signalgraph-backend"
}
```

## API Keys

All API key management endpoints require wallet auth.

Endpoint:

```text
POST /api/api-keys
```

### List API Keys

Request:

```json
{
  "action": "list",
  "wallet": {
    "address": "0xabc...",
    "message": "Login to Langclaw\nAddress: 0xabc...\nTime: 2026-05-15T10:00:00.000Z",
    "signature": "0x..."
  }
}
```

Response:

```json
{
  "configured": true,
  "keys": [
    {
      "id": "8e671aa0-9f93-4a1b-9f44-47a1d42d7f22",
      "name": "Production",
      "prefix": "lck_live_abc",
      "suffix": "xyz123",
      "maskedKey": "lck_live_abc********xyz123",
      "status": "active",
      "createdAt": "2026-05-15T10:00:00.000Z",
      "lastUsedAt": "2026-05-15T10:05:00.000Z"
    }
  ]
}
```

### Create API Key

Each wallet can have up to 3 active API keys.

Request:

```json
{
  "action": "create",
  "name": "Production",
  "wallet": {
    "address": "0xabc...",
    "message": "Login to Langclaw\nAddress: 0xabc...\nTime: 2026-05-15T10:00:00.000Z",
    "signature": "0x..."
  }
}
```

Response:

```json
{
  "configured": true,
  "key": {
    "id": "8e671aa0-9f93-4a1b-9f44-47a1d42d7f22",
    "name": "Production",
    "maskedKey": "lck_live_abc********xyz123",
    "status": "active",
    "createdAt": "2026-05-15T10:00:00.000Z"
  },
  "secret": "lck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

Store `secret` immediately. Langclaw returns it only once.

### Revoke API Key

Request:

```json
{
  "action": "revoke",
  "keyId": "8e671aa0-9f93-4a1b-9f44-47a1d42d7f22",
  "wallet": {
    "address": "0xabc...",
    "message": "Login to Langclaw\nAddress: 0xabc...\nTime: 2026-05-15T10:00:00.000Z",
    "signature": "0x..."
  }
}
```

Response:

```json
{
  "configured": true,
  "key": {
    "id": "8e671aa0-9f93-4a1b-9f44-47a1d42d7f22",
    "name": "Production",
    "maskedKey": "lck_live_abc********xyz123",
    "status": "revoked",
    "createdAt": "2026-05-15T10:00:00.000Z",
    "revokedAt": "2026-05-15T10:20:00.000Z"
  }
}
```

## OpenAI-Compatible Runtime API

These endpoints accept API key auth or wallet auth.

Use API key auth for server-to-server integrations.

### List Models

```http
GET /v1/models
```

Equivalent legacy route:

```http
GET /api/0g/models
```

Response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "0GM-1.0-35B-A3B",
      "type": "chatbot",
      "pricing": {
        "prompt": "1",
        "completion": "1"
      },
      "supported_parameters": ["temperature", "max_tokens"]
    }
  ]
}
```

### List Providers

```http
GET /v1/providers
```

Query parameters:

- `model`
- `model_id`
- `service_type`

Equivalent legacy route:

```http
GET /api/0g/providers
```

### Chat Completion

```http
POST /v1/chat/completions
```

Equivalent legacy route:

```http
POST /api/0g/chat/completions
```

Request:

```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LANGCLAW_API_KEY" \
  -d '{
    "model": "0GM-1.0-35B-A3B",
    "messages": [
      {
        "role": "user",
        "content": "Explain Langclaw in one sentence."
      }
    ],
    "max_tokens": 120,
    "temperature": 0.7
  }'
```

Response:

```json
{
  "id": "chatcmpl_...",
  "object": "chat.completion",
  "model": "0GM-1.0-35B-A3B",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Langclaw turns live research signals into verified AI answers with account-level usage tracking."
      }
    }
  ],
  "usage": {
    "wallet": "0xabc...",
    "model": "0GM-1.0-35B-A3B",
    "inputTokens": 20,
    "outputTokens": 32,
    "totalTokens": 52,
    "chargedNeuron": "123",
    "meter": {
      "model": "0GM-1.0-35B-A3B",
      "modelLabel": "0GM 1.0 35B A3B",
      "unit": "token",
      "tokenCost": 52,
      "totalConsumeNeuron": "123",
      "totalConsumeLabel": "123",
      "badge": {
        "modelLabel": "0GM 1.0 35B A3B",
        "totalConsumeNeuron": "123",
        "totalConsumeLabel": "123"
      },
      "outputDetails": {
        "title": "Output Details",
        "unit": "token",
        "totalTokens": 32,
        "items": [
          { "key": "deep_thinking", "label": "Deep Thinking", "tokens": 0, "color": "#e63ba7" },
          { "key": "text_output", "label": "Text Output", "tokens": 32, "color": "#2cc6a5" }
        ]
      },
      "consumeDetails": {
        "title": "Token Cost",
        "unit": "token",
        "totalTokens": 52,
        "cachedInputTokens": 0,
        "items": [
          { "key": "uncached_input", "label": "Uncached Input", "tokens": 20, "color": "#d9dadd" },
          { "key": "output", "label": "Output", "tokens": 32, "color": "#2cc6a5" }
        ]
      }
    }
  }
}
```

Supported chat parameters depend on the selected Router model. Langclaw forwards only parameters supported by that model.

Supported common parameters:

- `temperature`
- `top_p`
- `top_k`
- `max_tokens`
- `max_completion_tokens`
- `presence_penalty`
- `frequency_penalty`
- `repetition_penalty`
- `response_format`
- `stop`
- `seed`
- `tools`
- `tool_choice`
- `metadata`
- `verify_tee`

### Streaming Chat Completion

Set `stream` to `true`.

```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LANGCLAW_API_KEY" \
  -d '{
    "model": "0GM-1.0-35B-A3B",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Give me three Langclaw use cases."
      }
    ]
  }'
```

NDJSON events:

```json
{"type":"delta","delta":"Langclaw"}
{"type":"result","payload":{"answer":"Langclaw can...","model":"0GM-1.0-35B-A3B","usage":{}}}
```

### Image Generation

```http
POST /v1/images/generations
```

Equivalent legacy route:

```http
POST /api/0g/images/generations
```

Request:

```json
{
  "model": "z-image",
  "prompt": "A clean dashboard for verified AI research",
  "n": 1,
  "size": "1024x1024",
  "response_format": "b64_json"
}
```

Langclaw only accepts `response_format` as `b64_json`.

### Async Image Generation

Submit job:

```http
POST /v1/async/images/generations
```

Equivalent legacy route:

```http
POST /api/0g/async/images/generations
```

Poll job:

```http
GET /v1/async/jobs/{jobId}?reservation_id={reservationId}
```

Equivalent legacy route:

```http
GET /api/0g/async/jobs/{jobId}?reservation_id={reservationId}
```

Async job polling requires the same wallet or API key owner that created the reservation.

### Audio Transcription

```http
POST /v1/audio/transcriptions
```

Equivalent legacy route:

```http
POST /api/0g/audio/transcriptions
```

Request:

```bash
curl http://localhost:3001/v1/audio/transcriptions \
  -H "Authorization: Bearer $LANGCLAW_API_KEY" \
  -F "model=openai/whisper-large-v3" \
  -F "file=@meeting.mp3" \
  -F "response_format=json"
```

## Research API

Research endpoints accept wallet auth or API key auth.

### Run Discovery

```http
POST /api/discover
```

Request:

```json
{
  "topic": "AI agents for verifiable research"
}
```

Response fields:

- `topic`
- `generatedAt`
- `sources`
- `errors`
- `orchestration`
- `finalConclusion`
- `finalAnswer`
- `zeroG`
- `usage`

### Stream Discovery

```http
POST /api/discover/stream
```

Request:

```json
{
  "topic": "AI agents for verifiable research"
}
```

NDJSON events:

```json
{"type":"progress","event":{"stepId":"planner","status":"running"}}
{"type":"result","payload":{"topic":"AI agents for verifiable research"}}
```

## Chat API

### Stream Chat

```http
POST /api/chat/stream
```

Direct chat does not require billing reservation unless `researchTrend` or `useAgent` is true.

Agent chat accepts wallet auth or API key auth.

Request:

```json
{
  "message": "Find research signals for AI data provenance",
  "messages": [
    {
      "role": "user",
      "content": "Previous message"
    }
  ],
  "model": "0GM-1.0-35B-A3B",
  "researchTrend": true
}
```

NDJSON events:

```json
{"type":"mode","mode":"agent"}
{"type":"progress","event":{"stepId":"planner","status":"running"}}
{"type":"result","payload":{"finalAnswer":{"title":"..."}}}
```

### Chat Sessions

```http
POST /api/chat/sessions
```

Accepts wallet auth or API key auth.

Actions:

- `list`
- `get`
- `upsert`
- `delete`

List request:

```json
{
  "action": "list"
}
```

Get request:

```json
{
  "action": "get",
  "sessionId": "session_123"
}
```

Delete request:

```json
{
  "action": "delete",
  "sessionId": "session_123"
}
```

Upsert request:

```json
{
  "action": "upsert",
  "session": {
    "id": "session_123",
    "title": "Research session",
    "pinned": false,
    "createdAt": "2026-05-15T10:00:00.000Z",
    "updatedAt": "2026-05-15T10:05:00.000Z",
    "messages": [
      {
        "id": "msg_1",
        "role": "user",
        "content": "Find sources",
        "createdAt": "2026-05-15T10:00:00.000Z"
      }
    ]
  }
}
```

## Usage API

### Balance

```http
POST /api/usage/balance
```

Accepts wallet auth or API key auth.

Response:

```json
{
  "configured": true,
  "wallet": "0xabc...",
  "balance": {
    "availableNeuron": "1000000000000000000",
    "reservedNeuron": "0",
    "available0G": "1"
  },
  "quote": {
    "model": "0GM-1.0-35B-A3B",
    "estimatedCostNeuron": "123"
  }
}
```

### Quote

```http
POST /api/usage/quote
```

No wallet auth is required.

### Verify Deposit

```http
POST /api/usage/deposit/verify
```

Requires wallet auth.

API key auth is not accepted.

Request:

```json
{
  "txHash": "0x...",
  "reference": "0x...",
  "wallet": {
    "address": "0xabc...",
    "message": "Login to Langclaw\nAddress: 0xabc...\nTime: 2026-05-15T10:00:00.000Z",
    "signature": "0x..."
  }
}
```

### Withdraw Request

```http
POST /api/usage/withdraw/request
```

Requires wallet auth.

API key auth is not accepted.

Response:

```json
{
  "configured": true,
  "wallet": "0xabc...",
  "vaultAddress": "0x...",
  "functionName": "withdraw",
  "balance": {},
  "note": "Call withdraw(uint256 amount) from the connected wallet. Backend will verify the Withdrawal event before marking the request complete."
}
```

## Automation API

Automation endpoints accept wallet auth or API key auth.

### Tasks

```http
POST /api/automation/tasks
```

Actions:

- `list`
- `create`
- `update`
- `pause`
- `resume`
- `delete`
- `pause-all`
- `resume-all`

Create request:

```json
{
  "action": "create",
  "task": {
    "name": "Daily research digest",
    "project": "Langclaw Website",
    "prompt": "Summarize AI research trends",
    "status": "active",
    "triggerType": "schedule",
    "scheduleFrequency": "daily",
    "scheduleTime": "09:00",
    "timezone": "Asia/Jakarta"
  }
}
```

### Runs

```http
POST /api/automation/runs
```

Actions:

- `list`
- `run`
- `tick`

Run one task:

```json
{
  "action": "run",
  "taskId": "task_uuid",
  "triggeredBy": "manual"
}
```

### Settings

```http
POST /api/automation/settings
```

Actions:

- `get`
- `update`

Update request:

```json
{
  "action": "update",
  "settings": {
    "dailyLimit0G": "1",
    "monthlyCap0G": "10",
    "lowBalanceThreshold0G": "0.2",
    "thresholdAction": "notify",
    "limitBehavior": "pause",
    "retryPolicy": "3-attempts",
    "failureNotification": "in-app",
    "autoPauseRepeatedFailures": true,
    "writeRunLogsToMemory": true
  }
}
```

## Admin 0G Account API

Admin endpoints require `LANGCLAW_ADMIN_API_KEY`.

Use either header:

```http
Authorization: Bearer $LANGCLAW_ADMIN_API_KEY
```

or:

```http
X-Langclaw-Admin-Key: $LANGCLAW_ADMIN_API_KEY
```

Endpoints:

```http
GET /api/0g/admin/account/balance
GET /api/0g/admin/account/usage/stats
GET /api/0g/admin/account/usage/history
```

## Error Responses

Common error format:

```json
{
  "error": "Wallet signature or API key is required."
}
```

Common status codes:

- `400`: Invalid request body or invalid field.
- `401`: Missing or invalid auth.
- `402`: Insufficient 0G balance.
- `403`: Wallet or owner mismatch.
- `404`: Resource not found.
- `409`: API key limit or duplicate conflict.
- `429`: 0G Router rate limit.
- `500`: Backend error.
- `503`: Missing server config or upstream unavailable.

## Quick Start

1. Create an API key from the dashboard using wallet auth.
2. Store the returned secret in server-side environment variables.
3. Call the runtime API with bearer auth.

Example:

```bash
export LANGCLAW_API_KEY="lck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

curl http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LANGCLAW_API_KEY" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What is Langclaw?"
      }
    ]
  }'
```
