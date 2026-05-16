import "./env";

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Readable } from "node:stream";
import { once } from "node:events";

import { handleChatSessions } from "./routes/chat-sessions";
import { handleChatStream } from "./routes/chat-stream";
import { handleDiscover } from "./routes/discover";
import { handleDiscoverStream } from "./routes/discover-stream";
import { handleApiKeys } from "./routes/api-keys";
import { handleMemory, handleMemorySettings } from "./routes/memory";
import {
  handleAutomationRuns,
  handleAutomationSettings,
  handleAutomationTasks,
  handleAutomationNotifications,
  handleAutomationTelegramWebhook,
  handleAutomationWebhook,
} from "./routes/automation";
import {
  handleUsageBalance,
  handleUsageDepositVerify,
  handleUsageQuote,
  handleUsageWithdrawRequest,
} from "./routes/usage";
import {
  handleZeroGAdminAccountBalance,
  handleZeroGAdminUsageHistory,
  handleZeroGAdminUsageStats,
  handleZeroGAsyncImageGeneration,
  handleZeroGAsyncJob,
  handleZeroGAudioTranscription,
  handleZeroGChatCompletions,
  handleZeroGImageGeneration,
  handleZeroGModels,
  handleZeroGProviders,
} from "./routes/zero-g-router";

type RouteHandler = (request: Request) => Promise<Response> | Response;

const routes = new Map<string, RouteHandler>([
  ["POST /api/api-keys", handleApiKeys],
  ["POST /api/automation/runs", handleAutomationRuns],
  ["POST /api/automation/settings", handleAutomationSettings],
  ["POST /api/automation/tasks", handleAutomationTasks],
  ["POST /api/automation/notifications", handleAutomationNotifications],
  ["POST /api/automation/telegram/webhook", handleAutomationTelegramWebhook],
  ["POST /api/chat/sessions", handleChatSessions],
  ["POST /api/chat/stream", handleChatStream],
  ["POST /api/discover", handleDiscover],
  ["POST /api/discover/stream", handleDiscoverStream],
  ["POST /api/memory", handleMemory],
  ["POST /api/memory/settings", handleMemorySettings],
  ["POST /api/usage/balance", handleUsageBalance],
  ["POST /api/usage/deposit/verify", handleUsageDepositVerify],
  ["POST /api/usage/quote", handleUsageQuote],
  ["POST /api/usage/withdraw/request", handleUsageWithdrawRequest],
  ["GET /api/0g/models", handleZeroGModels],
  ["GET /api/0g/providers", handleZeroGProviders],
  ["POST /api/0g/chat/completions", handleZeroGChatCompletions],
  ["POST /api/0g/images/generations", handleZeroGImageGeneration],
  ["POST /api/0g/async/images/generations", handleZeroGAsyncImageGeneration],
  ["POST /api/0g/audio/transcriptions", handleZeroGAudioTranscription],
  ["GET /v1/models", handleZeroGModels],
  ["GET /v1/providers", handleZeroGProviders],
  ["POST /v1/chat/completions", handleZeroGChatCompletions],
  ["POST /v1/images/generations", handleZeroGImageGeneration],
  ["POST /v1/async/images/generations", handleZeroGAsyncImageGeneration],
  ["POST /v1/audio/transcriptions", handleZeroGAudioTranscription],
  ["GET /api/0g/admin/account/balance", handleZeroGAdminAccountBalance],
  ["GET /api/0g/admin/account/usage/stats", handleZeroGAdminUsageStats],
  ["GET /api/0g/admin/account/usage/history", handleZeroGAdminUsageHistory],
]);

const port = readPort(process.env.PORT, 3001);
const host = process.env.HOST || "0.0.0.0";

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, host, () => {
  console.log(`SignalGraph backend listening on http://${host}:${port}`);
});

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    const url = getRequestUrl(request);
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      await writeWebResponse(
        response,
        Response.json({ ok: true, service: "signalgraph-backend" }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      (url.pathname.startsWith("/api/0g/async/jobs/") ||
        url.pathname.startsWith("/v1/async/jobs/"))
    ) {
      const webRequest = createWebRequest(request, url);
      const webResponse = await handleZeroGAsyncJob(webRequest);
      await writeWebResponse(response, webResponse);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/automation/webhooks/")
    ) {
      const slug = decodeURIComponent(
        url.pathname.slice("/api/automation/webhooks/".length)
      );
      const webRequest = createWebRequest(request, url);
      const webResponse = await handleAutomationWebhook(webRequest, slug);
      await writeWebResponse(response, webResponse);
      return;
    }

    const routeKey = `${request.method || "GET"} ${url.pathname}`;
    const handler = routes.get(routeKey);

    if (!handler) {
      await writeWebResponse(
        response,
        Response.json({ error: "Not found." }, { status: 404 }),
      );
      return;
    }

    const webRequest = createWebRequest(request, url);
    const webResponse = await handler(webRequest);
    await writeWebResponse(response, webResponse);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }

    setCorsHeaders(response);
    await writeWebResponse(
      response,
      Response.json(
        {
          error:
            error instanceof Error ? error.message : "Internal server error.",
        },
        { status: 500 },
      ),
    );
  }
}

function createWebRequest(request: IncomingMessage, url: URL) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const controller = new AbortController();
  request.on("aborted", () => controller.abort());

  const init: RequestInit & { duplex?: "half" } = {
    headers,
    method: request.method,
    signal: controller.signal,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Readable.toWeb(request) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function writeWebResponse(
  response: ServerResponse,
  webResponse: Response,
) {
  response.socket?.setNoDelay(true);
  response.statusCode = webResponse.status;
  response.statusMessage = webResponse.statusText;

  webResponse.headers.forEach((value, name) => {
    response.setHeader(name, value);
  });
  setCorsHeaders(response);

  if (!webResponse.body) {
    response.end();
    return;
  }

  response.flushHeaders();

  const reader = webResponse.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        const canContinue = response.write(Buffer.from(value));

        if (!canContinue) {
          await once(response, "drain");
        }
      }
    }
  } finally {
    response.end();
  }
}

function getRequestUrl(request: IncomingMessage) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || "http";
  const hostHeader = request.headers.host || `${host}:${port}`;

  return new URL(request.url || "/", `${protocol}://${hostHeader}`);
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader(
    "Access-Control-Allow-Origin",
    process.env.CORS_ORIGIN || "*",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "X-Langclaw-Admin-Key",
      "X-Langclaw-Wallet-Address",
      "X-Langclaw-Wallet-Message",
      "X-Langclaw-Wallet-Signature",
    ].join(", "),
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function readPort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
