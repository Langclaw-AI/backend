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

  const payload = await runSignalGraphWorkflow(topic);

  return NextResponse.json(payload);
}
