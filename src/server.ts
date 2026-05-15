import "./env";

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Readable } from "node:stream";

import { handleChatSessions } from "./routes/chat-sessions";
import { handleChatStream } from "./routes/chat-stream";
import { handleDiscover } from "./routes/discover";
import { handleDiscoverStream } from "./routes/discover-stream";

type RouteHandler = (request: Request) => Promise<Response> | Response;

const routes = new Map<string, RouteHandler>([
  ["POST /api/chat/sessions", handleChatSessions],
  ["POST /api/chat/stream", handleChatStream],
  ["POST /api/discover", handleDiscover],
  ["POST /api/discover/stream", handleDiscoverStream],
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

  const reader = webResponse.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        response.write(Buffer.from(value));
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
    "Content-Type, Authorization",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function readPort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
