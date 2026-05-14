import { NextRequest, NextResponse } from "next/server";

import { runSignalGraphWorkflow } from "@/lib/signalgraph/workflow";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let topic = "";

  try {
    const body = (await request.json()) as { topic?: unknown };
    topic = typeof body.topic === "string" ? body.topic.trim() : "";
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!topic) {
    return NextResponse.json(
      { error: "Topic is required for Auto Discovery." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const payload = await runSignalGraphWorkflow(topic, {
          onEvent: (event) => {
            write({ type: "progress", event });
          },
        });

        write({ type: "result", payload });
      } catch (error) {
        write({
          type: "error",
          error: error instanceof Error ? error.message : "Discovery failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}
