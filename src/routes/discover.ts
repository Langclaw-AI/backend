import { runSignalGraphWorkflow } from "../lib/signalgraph/workflow";

export async function handleDiscover(request: Request) {
  let topic = "";

  try {
    const body = (await request.json()) as { topic?: unknown };
    topic = typeof body.topic === "string" ? body.topic.trim() : "";
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!topic) {
    return Response.json(
      { error: "Topic is required for Auto Discovery." },
      { status: 400 }
    );
  }

  const payload = await runSignalGraphWorkflow(topic);

  return Response.json(payload);
}
