import { runSignalGraphWorkflow } from "../lib/signalgraph/workflow";
import type { WalletAuthInput } from "../lib/server/wallet-auth";
import {
  refundResearchUsage,
  reserveResearchUsage,
  settleResearchUsage,
  usageErrorResponse,
  type UsageReservation,
} from "../lib/usage";

export async function handleDiscover(request: Request) {
  let topic = "";
  let wallet: WalletAuthInput = {};
  let reservation: UsageReservation | undefined;

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

  try {
    reservation = await reserveResearchUsage(wallet);
    const payload = await runSignalGraphWorkflow(topic);
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

    return Response.json(payload);
  } catch (error) {
    if (reservation) {
      await refundResearchUsage(
        reservation,
        error instanceof Error ? error.message : "Discovery failed."
      ).catch(() => undefined);
    }

    return usageErrorResponse(error);
  }
}
