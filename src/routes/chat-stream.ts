import type { DirectChatPayload } from "../lib/chat-sessions";
import { runSignalGraphWorkflow } from "../lib/signalgraph/workflow";
import type { WorkflowProgressEvent } from "../lib/signalgraph/types";
import { streamDirectChatWithZeroGCompute } from "../lib/zero-g-direct-chat";

type ChatMessageInput = {
  role?: unknown;
  content?: unknown;
};

type ChatRequestBody = {
  message?: unknown;
  messages?: unknown;
  researchTrend?: unknown;
  sessionId?: unknown;
  useAgent?: unknown;
  model?: unknown;
};

type ContextMessage = {
  role: "assistant" | "user";
  content: string;
};

export async function handleChatStream(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const context = readContextMessages(body.messages);
  const useAgent = body.researchTrend === true || body.useAgent === true;

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const stopIfAborted = () => {
        if (closed || request.signal.aborted) {
          closed = true;
          throw new Error("Request aborted.");
        }
      };

      const write = (payload: unknown) => {
        if (closed || request.signal.aborted) {
          return;
        }

        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
        },
        { once: true }
      );

      try {
        stopIfAborted();

        if (!useAgent) {
          let streamedAnswer = "";
          const direct = await streamDirectChatWithZeroGCompute({
            context,
            message,
            signal: request.signal,
            onDelta: (delta) => {
              stopIfAborted();
              streamedAnswer += delta;
              write({ type: "direct_delta", delta });
            },
          });

          stopIfAborted();
          write({
            type: "direct",
            payload: {
              answer: direct.answer || streamedAnswer,
              model: direct.model,
              source: direct.source,
            } satisfies DirectChatPayload,
          });
          return;
        }

        const topic = buildAgentTopic(message, context);

        write({ type: "mode", mode: "agent" });
        const payload = await runSignalGraphWorkflow(topic, {
          onEvent: (event: WorkflowProgressEvent) => {
            stopIfAborted();
            write({ type: "progress", event });
          },
        });

        stopIfAborted();
        write({ type: "result", payload });
      } catch (error) {
        if (!request.signal.aborted) {
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Chat failed.",
          });
        }
      } finally {
        closed = true;
        if (!request.signal.aborted) {
          controller.close();
        }
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

function readContextMessages(value: unknown): ContextMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item: ChatMessageInput) => {
      const role = item?.role;
      const content =
        typeof item?.content === "string" ? item.content.trim() : "";

      if ((role !== "assistant" && role !== "user") || !content) {
        return null;
      }

      return { role, content };
    })
    .filter((item): item is ContextMessage => Boolean(item))
    .slice(-12);
}

function buildAgentTopic(message: string, context: ContextMessage[]) {
  if (!isContextualFollowUp(message)) {
    return message;
  }

  const previousUser = [...context]
    .reverse()
    .find((item) => item.role === "user" && item.content !== message);

  if (!previousUser) {
    return message;
  }

  return `${previousUser.content}. Follow-up request: ${message}`;
}

function isContextualFollowUp(message: string) {
  return /\b(itu|tadi|sebelumnya|lanjut|lanjutkan|same|that|previous|di atas|tersebut)\b/i.test(
    message
  );
}
