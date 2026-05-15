import type { DirectChatPayload } from "../lib/chat-sessions";
import type { WalletAuthInput } from "../lib/server/wallet-auth";
import { runSignalGraphWorkflow } from "../lib/signalgraph/workflow";
import type { WorkflowProgressEvent } from "../lib/signalgraph/types";
import {
  refundResearchUsage,
  reserveResearchUsage,
  settleResearchUsage,
  usageErrorResponse,
  type UsageReservation,
} from "../lib/usage";
import { streamDirectChatWithZeroGCompute } from "../lib/zero-g-direct-chat";

type ChatMessageInput = {
  role?: unknown;
  content?: unknown;
};

type ChatRequestBody = {
  attachments?: unknown;
  files?: unknown;
  message?: unknown;
  messages?: unknown;
  researchTrend?: unknown;
  sessionId?: unknown;
  useAgent?: unknown;
  wallet?: WalletAuthInput;
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

  if (hasUnsupportedAttachments(body)) {
    return Response.json(
      {
        error:
          "Multimodal attachments are not supported by the backend yet.",
      },
      { status: 400 }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const context = readContextMessages(body.messages);
  const useAgent = body.researchTrend === true || body.useAgent === true;

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  let reservation: UsageReservation | undefined;

  if (useAgent) {
    try {
      reservation = await reserveResearchUsage(body.wallet ?? {});
    } catch (error) {
      return usageErrorResponse(error);
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let usageSettled = false;

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
            requestedModel: body.model,
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
              fallbackFrom: direct.fallbackFrom,
              model: direct.model,
              modelHonored: direct.modelHonored,
              requestedModel: direct.requestedModel,
              source: direct.source,
              teeVerified: direct.teeVerified,
              teeVerification: direct.teeVerification,
              usedModel: direct.usedModel,
            } satisfies DirectChatPayload,
          });
          return;
        }

        const topic = buildAgentTopic(message, context);

        write({ type: "mode", mode: "agent" });
        const payload = await runSignalGraphWorkflow(
          topic,
          buildChatWorkflowOptions(body.model, (event: WorkflowProgressEvent) => {
            stopIfAborted();
            write({ type: "progress", event });
          })
        );
        payload.usage = await settleResearchUsage({
          computeStatus: payload.zeroG?.compute?.status,
          reservation: reservation!,
          routerTrace: payload.zeroG?.compute
            ? {
                billing: payload.zeroG.compute.billing,
                provider: payload.zeroG.compute.provider,
                requestId: payload.zeroG.compute.requestId,
                teeVerified: payload.zeroG.compute.teeVerified,
              }
            : undefined,
          tokenUsage: payload.zeroG?.compute?.usage,
          topic,
        });
        usageSettled = true;

        stopIfAborted();
        write({ type: "result", payload });
      } catch (error) {
        if (reservation && !usageSettled) {
          await refundResearchUsage(
            reservation,
            error instanceof Error ? error.message : "Chat failed."
          ).catch(() => undefined);
        }

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

export function buildChatWorkflowOptions(
  requestedModel: unknown,
  onEvent: (event: WorkflowProgressEvent) => void | Promise<void>
) {
  return {
    requestedModel,
    onEvent,
  };
}

function hasUnsupportedAttachments(body: ChatRequestBody) {
  if (hasItems(body.attachments) || hasItems(body.files)) {
    return true;
  }

  const values = [
    body.message,
    ...(Array.isArray(body.messages) ? body.messages : []),
  ];

  return values.some((value) => containsFilePart(value));
}

function hasItems(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
}

function containsFilePart(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(containsFilePart);
  }

  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";

  if (
    type === "file" ||
    type === "image" ||
    type === "image_url" ||
    type === "fileuipart"
  ) {
    return true;
  }

  return Object.values(record).some(containsFilePart);
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
