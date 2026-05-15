import type { WalletAuthInput } from "../lib/server/wallet-auth";
import {
  buildUsageQuote,
  buildWithdrawRequest,
  readUsageBalance,
  usageErrorResponse,
  verifyUsageDeposit,
} from "../lib/usage";

type UsageRequestBody = {
  wallet?: WalletAuthInput;
  txHash?: unknown;
  reference?: unknown;
};

export async function handleUsageBalance(request: Request) {
  let body: UsageRequestBody;

  try {
    body = (await request.json()) as UsageRequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  try {
    const payload = await readUsageBalance({
      request,
      wallet: body.wallet ?? {},
    });

    return Response.json(payload);
  } catch (error) {
    return usageErrorResponse(error);
  }
}

export async function handleUsageQuote() {
  try {
    const quote = await buildUsageQuote();

    return Response.json({
      configured: true,
      quote,
    });
  } catch (error) {
    return usageErrorResponse(error);
  }
}

export async function handleUsageDepositVerify(request: Request) {
  let body: UsageRequestBody;

  try {
    body = (await request.json()) as UsageRequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  try {
    const payload = await verifyUsageDeposit({
      reference: body.reference,
      txHash: body.txHash,
      wallet: body.wallet ?? {},
    });

    return Response.json(payload);
  } catch (error) {
    return usageErrorResponse(error);
  }
}

export async function handleUsageWithdrawRequest(request: Request) {
  let body: UsageRequestBody;

  try {
    body = (await request.json()) as UsageRequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  try {
    const payload = await buildWithdrawRequest(body.wallet ?? {});

    return Response.json(payload);
  } catch (error) {
    return usageErrorResponse(error);
  }
}
