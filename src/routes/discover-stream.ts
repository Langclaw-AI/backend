import { runSignalGraphWorkflow } from "../lib/signalgraph/workflow";
import type { WalletAuthInput } from "../lib/server/wallet-auth";
import {
  refundResearchUsage,
  reserveResearchUsage,
  settleResearchUsage,
  usageErrorResponse,
} from "../lib/usage";

export async function handleDiscoverStream(request: Request) {
  let topic = "";
  let wallet: WalletAuthInput = {};

  try {
    const body = (await request.json()) as {
      topic?: unknown;
      wallet?: WalletAuthInput;
    };
    topic = typeof body.topic === "string" ? body.topic.trim() : "";
    wallet = body.wallet ?? {};
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

  const reservation = await reserveResearchUsage({ request, wallet }).catch(
    (error) => ({
      error,
    })
  );

  if ("error" in reservation) {
    return usageErrorResponse(reservation.error);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let settled = false;
      const write = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const payload = await runSignalGraphWorkflow(topic, {
          onEvent: (event) => {
            write({ type: "progress", event });
          },
        });
        payload.usage = await settleResearchUsage({
          computeStatus: payload.zeroG?.compute?.status,
          reservation,
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
        settled = true;

        write({ type: "result", payload });
      } catch (error) {
        if (!settled) {
          await refundResearchUsage(
            reservation,
            error instanceof Error ? error.message : "Discovery failed."
          ).catch(() => undefined);
        }

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
      "Connection": "keep-alive",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
