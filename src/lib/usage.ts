import { randomUUID } from "node:crypto";

import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";

import {
  AccountAuthError,
  requireAccountAuth,
  requireWalletAccount,
  type AccountAuthInput,
} from "./server/account-auth";
import type { WalletAuthInput } from "./server/wallet-auth";
import { getSupabaseAdmin } from "./supabase/server";
import type {
  ModelUsageReceipt,
  ZeroGComputeStatus,
  ZeroGTokenUsage,
} from "./signalgraph/types";
import {
  findRouterModel,
  getDefaultRouterModel,
  getRouterEndpoint,
  requireRouterModelForService,
  type RouterTrace,
} from "./zero-g/router";
import {
  applyMarkupNeuron,
  buildUsageMeter,
  calculateMarkupNeuron,
  calculateTokenCostNeuron,
  mapUiTokenUsage,
  readUsageMarkupBps,
  selectUsageCost,
} from "./usage-pricing";

type UsageWallet = {
  address: string;
};

type UsageAccountRow = {
  available_neuron: string | number;
  reserved_neuron: string | number;
  lifetime_charged_neuron: string | number;
  lifetime_deposited_neuron: string | number;
  wallet_address: string;
  wallet_user_id: string;
};

type UsageRpcRow = Record<string, unknown>;

export type UsageQuoteInput = {
  estimatedCompletionTokens?: number;
  estimatedPromptTokens?: number;
  imageCount?: number;
  model?: string;
  service?: "audio" | "chat" | "image";
};

export type UsageQuote = {
  model: string;
  endpoint: string;
  promptPriceNeuron: string;
  completionPriceNeuron: string;
  imagePriceNeuron?: string;
  promptPriceUsd?: string;
  completionPriceUsd?: string;
  imagePriceUsd?: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCostNeuron: string;
  estimatedCost0G: string;
  priceFetchedAt: string;
};

export type UsageReservation = {
  reservationId: string;
  wallet: string;
  model: string;
  promptPriceNeuron: string;
  completionPriceNeuron: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  reservedNeuron: string;
  balanceBefore: string;
  balanceAfterReserve: string;
};

export class UsageHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const defaultMainnetRpc = "https://evmrpc.0g.ai";
const defaultChainId = 16661;
const neuronPer0G = 1_000_000_000_000_000_000n;
const depositEventAbi = parseAbiItem(
  "event Deposit(address indexed payer,uint256 amount,bytes32 indexed depositReference)"
);

export function usageErrorResponse(error: unknown) {
  if (error instanceof UsageHttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Usage billing failed." },
    { status: 500 }
  );
}

export async function readUsageBalance(authInput: AccountAuthInput) {
  const context = await requireUsageContext(authInput);
  const account = await ensureUsageAccount(context.walletUser.id, context.wallet);
  const quote = await buildUsageQuote().catch(() => undefined);

  return {
    configured: true,
    wallet: context.wallet.address,
    balance: accountToBalance(account),
    quote,
  };
}

export async function buildUsageQuote(
  input: UsageQuoteInput = {}
): Promise<UsageQuote> {
  const price = await readActiveModelPrice(input);
  const estimatedPromptTokens =
    input.estimatedPromptTokens ??
    readPositiveInt(process.env.LANGCLAW_USAGE_ESTIMATED_PROMPT_TOKENS, 6000);
  const estimatedCompletionTokens =
    input.estimatedCompletionTokens ??
    readEstimatedCompletionUnits(input, price.imagePriceNeuron);
  const estimatedCost = BigInt(calculateTokenCostNeuron({
    promptPriceNeuron: price.promptPriceNeuron,
    completionPriceNeuron: price.completionPriceNeuron,
    promptTokens: estimatedPromptTokens,
    completionTokens: estimatedCompletionTokens,
  }));

  return {
    model: price.model,
    endpoint: price.endpoint,
    promptPriceNeuron: price.promptPriceNeuron,
    completionPriceNeuron: price.completionPriceNeuron,
    imagePriceNeuron: price.imagePriceNeuron,
    promptPriceUsd: price.promptPriceUsd,
    completionPriceUsd: price.completionPriceUsd,
    imagePriceUsd: price.imagePriceUsd,
    estimatedPromptTokens,
    estimatedCompletionTokens,
    estimatedCostNeuron: estimatedCost.toString(),
    estimatedCost0G: formatNeuronAs0G(estimatedCost),
    priceFetchedAt: new Date(price.fetchedAt).toISOString(),
  };
}

export async function reserveResearchUsage(
  authInput: AccountAuthInput,
  quoteInput: UsageQuoteInput = {}
): Promise<UsageReservation> {
  const context = await requireUsageContext(authInput);
  const quote = await buildUsageQuote(quoteInput);
  const reservationId = randomUUID();
  const reservedNeuron = quote.estimatedCostNeuron;
  const { data, error } = await context.supabase.rpc(
    "langclaw_usage_reserve_balance",
    {
      p_completion_price_neuron: quote.completionPriceNeuron,
      p_estimated_completion_tokens: quote.estimatedCompletionTokens,
      p_estimated_prompt_tokens: quote.estimatedPromptTokens,
      p_model: quote.model,
      p_prompt_price_neuron: quote.promptPriceNeuron,
      p_reservation_id: reservationId,
      p_reserved_neuron: reservedNeuron,
      p_wallet_address: context.wallet.address,
      p_wallet_user_id: context.walletUser.id,
    }
  );

  if (error) {
    if (error.message.toLowerCase().includes("insufficient_balance")) {
      throw new UsageHttpError(402, "Insufficient 0G balance.");
    }

    throw new UsageHttpError(500, error.message);
  }

  const row = firstRpcRow(data);

  if (!row) {
    throw new UsageHttpError(500, "Usage reservation was not created.");
  }

  return {
    reservationId,
    wallet: context.wallet.address,
    model: quote.model,
    promptPriceNeuron: quote.promptPriceNeuron,
    completionPriceNeuron: quote.completionPriceNeuron,
    estimatedPromptTokens: quote.estimatedPromptTokens,
    estimatedCompletionTokens: quote.estimatedCompletionTokens,
    reservedNeuron,
    balanceBefore: readDecimalString(row.balance_before_neuron),
    balanceAfterReserve: readDecimalString(row.balance_after_neuron),
  };
}

export async function readUsageReservation(
  authInput: AccountAuthInput,
  reservationId: string
): Promise<UsageReservation> {
  const context = await requireUsageContext(authInput);
  const { data, error } = await context.supabase
    .from("langclaw_usage_reservations")
    .select(
      "id,wallet_address,model,prompt_price_neuron,completion_price_neuron,estimated_prompt_tokens,estimated_completion_tokens,reserved_neuron,balance_before_neuron,balance_after_reserve_neuron,status"
    )
    .eq("id", reservationId)
    .eq("wallet_user_id", context.walletUser.id)
    .maybeSingle();

  if (error) {
    throw new UsageHttpError(500, error.message);
  }

  if (!data) {
    throw new UsageHttpError(404, "Usage reservation was not found.");
  }

  return {
    reservationId: data.id,
    wallet: data.wallet_address,
    model: data.model,
    promptPriceNeuron: readDecimalString(data.prompt_price_neuron),
    completionPriceNeuron: readDecimalString(data.completion_price_neuron),
    estimatedPromptTokens: data.estimated_prompt_tokens,
    estimatedCompletionTokens: data.estimated_completion_tokens,
    reservedNeuron: readDecimalString(data.reserved_neuron),
    balanceBefore: readDecimalString(data.balance_before_neuron),
    balanceAfterReserve: readDecimalString(data.balance_after_reserve_neuron),
  };
}

export async function settleResearchUsage({
  computeStatus,
  reservation,
  routerTrace,
  topic,
  tokenUsage,
}: {
  computeStatus?: ZeroGComputeStatus;
  reservation: UsageReservation;
  routerTrace?: RouterTrace;
  topic: string;
  tokenUsage?: ZeroGTokenUsage;
}): Promise<ModelUsageReceipt> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new UsageHttpError(503, "Supabase service role key is required.");
  }

  const promptTokens = tokenUsage?.promptTokens ?? 0;
  const completionTokens = tokenUsage?.completionTokens ?? 0;
  const totalTokens =
    tokenUsage?.totalTokens ||
    (promptTokens || completionTokens ? promptTokens + completionTokens : 0);
  const selection = selectUsageCost({
    completionPriceNeuron: reservation.completionPriceNeuron,
    computeStatus,
    promptPriceNeuron: reservation.promptPriceNeuron,
    reservedNeuron: reservation.reservedNeuron,
    routerTrace,
    tokenUsage,
  });
  const rawCostNeuron = selection.chargedRawNeuron;
  const markupBps = readUsageMarkupBps();
  const markupNeuron = calculateMarkupNeuron(rawCostNeuron, markupBps);
  const chargedNeuron = applyMarkupNeuron(rawCostNeuron, markupBps);
  const uiTokenUsage = mapUiTokenUsage({
    ...(tokenUsage ?? {}),
    totalTokens: tokenUsage?.totalTokens ?? (totalTokens || undefined),
  });

  const { data, error } = await supabase.rpc(
    "langclaw_usage_finalize_reservation",
    {
      p_charged_neuron: chargedNeuron,
      p_completion_tokens: completionTokens,
      p_prompt_tokens: promptTokens,
      p_reservation_id: reservation.reservationId,
      p_status: selection.status,
      p_topic: topic,
      p_total_tokens: totalTokens,
    }
  );

  if (error) {
    throw new UsageHttpError(500, error.message);
  }

  const row = firstRpcRow(data);

  if (!row) {
    throw new UsageHttpError(500, "Usage charge was not finalized.");
  }

  return {
    wallet: reservation.wallet,
    model: reservation.model,
    requestId: routerTrace?.requestId,
    provider: routerTrace?.provider,
    teeVerified: routerTrace?.teeVerified,
    ...uiTokenUsage,
    promptPriceNeuron: reservation.promptPriceNeuron,
    completionPriceNeuron: reservation.completionPriceNeuron,
    reservedNeuron: reservation.reservedNeuron,
    rawCostNeuron,
    markupBps,
    markupNeuron,
    chargedNeuron: readDecimalString(row.charged_neuron),
    releasedNeuron: readDecimalString(row.released_neuron),
    balanceBefore: reservation.balanceBefore,
    balanceAfter: readDecimalString(row.balance_after_neuron),
    costSource: selection.costSource,
    totalCostNeuron: rawCostNeuron === "0" ? undefined : rawCostNeuron,
    meter: buildUsageMeter({
      model: reservation.model,
      tokenUsage: uiTokenUsage,
      totalConsumeNeuron: readDecimalString(row.charged_neuron),
    }),
    status: readUsageStatus(row.status),
  };
}

export async function refundResearchUsage(
  reservation: UsageReservation,
  reason: string
): Promise<ModelUsageReceipt> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new UsageHttpError(503, "Supabase service role key is required.");
  }

  const { data, error } = await supabase.rpc(
    "langclaw_usage_refund_reservation",
    {
      p_reason: reason,
      p_reservation_id: reservation.reservationId,
    }
  );

  if (error) {
    throw new UsageHttpError(500, error.message);
  }

  const row = firstRpcRow(data);

  return {
    wallet: reservation.wallet,
    model: reservation.model,
    promptPriceNeuron: reservation.promptPriceNeuron,
    completionPriceNeuron: reservation.completionPriceNeuron,
    reservedNeuron: reservation.reservedNeuron,
    rawCostNeuron: "0",
    markupBps: readUsageMarkupBps(),
    markupNeuron: "0",
    chargedNeuron: "0",
    releasedNeuron: row
      ? readDecimalString(row.released_neuron)
      : reservation.reservedNeuron,
    balanceBefore: reservation.balanceBefore,
    balanceAfter: row
      ? readDecimalString(row.balance_after_neuron)
      : reservation.balanceBefore,
    costSource: "reserved-estimate",
    meter: buildUsageMeter({
      model: reservation.model,
      totalConsumeNeuron: "0",
    }),
    status: "failed_after_charge",
  };
}

export async function verifyUsageDeposit({
  reference,
  txHash,
  wallet: walletInput,
}: {
  reference?: unknown;
  txHash?: unknown;
  wallet: WalletAuthInput;
}) {
  const context = await requireWalletUsageContext(walletInput);
  const hash = readTxHash(txHash);
  const vaultAddress = readVaultAddress();
  const client = createUsagePublicClient();
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }),
  ]);

  if (receipt.status !== "success") {
    throw new UsageHttpError(400, "Deposit transaction did not succeed.");
  }

  if (!tx.to || getAddress(tx.to) !== vaultAddress) {
    throw new UsageHttpError(400, "Invalid deposit receiver.");
  }

  if (getAddress(tx.from) !== getAddress(context.wallet.address)) {
    throw new UsageHttpError(403, "Wallet mismatch.");
  }

  if (tx.value <= 0n) {
    throw new UsageHttpError(400, "Deposit amount must be greater than zero.");
  }

  const depositEvent = readDepositEvent(receipt.logs, vaultAddress);

  if (!depositEvent) {
    throw new UsageHttpError(400, "Deposit event was not found.");
  }

  if (getAddress(depositEvent.payer) !== getAddress(context.wallet.address)) {
    throw new UsageHttpError(403, "Deposit event wallet mismatch.");
  }

  if (depositEvent.amountNeuron !== tx.value.toString()) {
    throw new UsageHttpError(400, "Deposit event amount does not match tx value.");
  }

  const expectedReference = readOptionalBytes32(reference);

  if (
    expectedReference &&
    depositEvent.reference.toLowerCase() !== expectedReference.toLowerCase()
  ) {
    throw new UsageHttpError(400, "Deposit reference mismatch.");
  }

  const { data, error } = await context.supabase.rpc(
    "langclaw_usage_credit_deposit",
    {
      p_amount_neuron: depositEvent.amountNeuron,
      p_block_number: receipt.blockNumber.toString(),
      p_log_index: depositEvent.logIndex,
      p_reference: depositEvent.reference,
      p_tx_hash: hash.toLowerCase(),
      p_wallet_address: context.wallet.address,
      p_wallet_user_id: context.walletUser.id,
    }
  );

  if (error) {
    throw new UsageHttpError(500, error.message);
  }

  const row = firstRpcRow(data);

  if (!row) {
    throw new UsageHttpError(500, "Deposit was not credited.");
  }

  return {
    configured: true,
    wallet: context.wallet.address,
    txHash: hash.toLowerCase(),
    amountNeuron: depositEvent.amountNeuron,
    amount0G: formatNeuronAs0G(BigInt(depositEvent.amountNeuron)),
    credited: readBoolean(row.credited),
    balanceBefore: readDecimalString(row.balance_before_neuron),
    balanceAfter: readDecimalString(row.balance_after_neuron),
  };
}

export async function buildWithdrawRequest(walletInput: WalletAuthInput) {
  const context = await requireWalletUsageContext(walletInput);
  const account = await ensureUsageAccount(context.walletUser.id, context.wallet);
  const vaultAddress = readVaultAddress();

  return {
    configured: true,
    wallet: context.wallet.address,
    vaultAddress,
    functionName: "withdraw",
    balance: accountToBalance(account),
    note:
      "Call withdraw(uint256 amount) from the connected wallet. Backend will verify the Withdrawal event before marking the request complete.",
  };
}

async function requireUsageContext(authInput: AccountAuthInput) {
  try {
    const account = await requireAccountAuth(authInput);

    return {
      supabase: account.supabase,
      wallet: { address: account.walletUser.walletAddress },
      walletUser: { id: account.walletUser.id },
    };
  } catch (error) {
    throw mapUsageAuthError(error);
  }
}

async function requireWalletUsageContext(walletInput: WalletAuthInput) {
  try {
    const account = await requireWalletAccount(walletInput);

    return {
      supabase: account.supabase,
      wallet: { address: account.walletUser.walletAddress },
      walletUser: { id: account.walletUser.id },
    };
  } catch (error) {
    throw mapUsageAuthError(error);
  }
}

async function ensureUsageAccount(
  walletUserId: string,
  wallet: UsageWallet
): Promise<UsageAccountRow> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new UsageHttpError(503, "Supabase service role key is required.");
  }

  const { data, error } = await supabase
    .from("langclaw_usage_accounts")
    .upsert(
      {
        wallet_address: wallet.address,
        wallet_user_id: walletUserId,
      },
      { onConflict: "wallet_user_id" }
    )
    .select(
      "wallet_user_id,wallet_address,available_neuron,reserved_neuron,lifetime_deposited_neuron,lifetime_charged_neuron"
    )
    .single();

  if (error || !data) {
    throw new UsageHttpError(
      500,
      error?.message || "Unable to read usage balance."
    );
  }

  return data as UsageAccountRow;
}

function mapUsageAuthError(error: unknown) {
  if (error instanceof AccountAuthError) {
    return new UsageHttpError(error.status, error.message);
  }

  return error;
}

async function readActiveModelPrice(input: UsageQuoteInput = {}) {
  const endpoint = getRouterEndpoint();
  const service = input.service || "chat";
  const model = input.model?.trim() || getDefaultRouterModel(service);
  const selected = requireRouterModelForService({
    model: await findRouterModel(model),
    modelId: model,
    service,
  });

  const promptPriceNeuron = readNeuronString(selected.pricing?.prompt);
  const imagePriceNeuron = readNeuronString(selected.pricing?.image);
  const completionPriceNeuron =
    service === "image" && imagePriceNeuron
      ? imagePriceNeuron
      : readNeuronString(selected.pricing?.completion);

  if (!promptPriceNeuron || !completionPriceNeuron) {
    throw new UsageHttpError(
      503,
      `0G Router model ${model} does not expose token pricing.`
    );
  }

  return {
    model,
    endpoint,
    promptPriceNeuron,
    completionPriceNeuron,
    imagePriceNeuron,
    promptPriceUsd: readString(selected.pricing_usd?.prompt) || undefined,
    completionPriceUsd:
      readString(selected.pricing_usd?.completion) || undefined,
    imagePriceUsd: readString(selected.pricing_usd?.image) || undefined,
    fetchedAt: Date.now(),
  };
}

function readEstimatedCompletionUnits(
  input: UsageQuoteInput,
  imagePriceNeuron?: string
) {
  if (input.estimatedCompletionTokens !== undefined) {
    return input.estimatedCompletionTokens;
  }

  if (input.service === "image" && imagePriceNeuron) {
    return Math.max(1, input.imageCount ?? 1);
  }

  if (input.service === "audio") {
    return readPositiveInt(
      process.env.LANGCLAW_USAGE_ESTIMATED_AUDIO_COMPLETION_TOKENS,
      1200
    );
  }

  return readPositiveInt(
    process.env.LANGCLAW_USAGE_ESTIMATED_COMPLETION_TOKENS,
    1200
  );
}

function accountToBalance(account: UsageAccountRow) {
  const availableNeuron = readDecimalString(account.available_neuron);
  const reservedNeuron = readDecimalString(account.reserved_neuron);
  const lifetimeDepositedNeuron = readDecimalString(
    account.lifetime_deposited_neuron
  );
  const lifetimeChargedNeuron = readDecimalString(
    account.lifetime_charged_neuron
  );

  return {
    availableNeuron,
    available0G: formatNeuronAs0G(BigInt(availableNeuron)),
    reservedNeuron,
    reserved0G: formatNeuronAs0G(BigInt(reservedNeuron)),
    lifetimeDepositedNeuron,
    lifetimeDeposited0G: formatNeuronAs0G(BigInt(lifetimeDepositedNeuron)),
    lifetimeChargedNeuron,
    lifetimeCharged0G: formatNeuronAs0G(BigInt(lifetimeChargedNeuron)),
  };
}

function createUsagePublicClient() {
  const rpcUrl =
    process.env.OG_CHAIN_RPC_URL?.trim() ||
    process.env.OG_RPC_URL?.trim() ||
    defaultMainnetRpc;
  const chainId = readPositiveInt(process.env.OG_CHAIN_ID, defaultChainId);
  const chain = defineChain({
    id: chainId,
    name: chainId === 16661 ? "0G Mainnet" : "0G Custom Network",
    nativeCurrency: {
      decimals: 18,
      name: "0G",
      symbol: "0G",
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
  });

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

function readDepositEvent(
  logs: Array<{
    address: Address;
    data: Hex;
    logIndex: number;
    topics: [signature: Hex, ...args: Hex[]] | [];
  }>,
  vaultAddress: Address
) {
  for (const log of logs) {
    if (getAddress(log.address) !== vaultAddress) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: [depositEventAbi],
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as {
        amount?: bigint;
        depositReference?: Hex;
        payer?: Address;
      };

      if (
        !args.payer ||
        args.amount === undefined ||
        !args.depositReference
      ) {
        continue;
      }

      return {
        amountNeuron: args.amount.toString(),
        logIndex: log.logIndex,
        payer: getAddress(args.payer),
        reference: args.depositReference,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function readVaultAddress() {
  const address = process.env.LANGCLAW_USAGE_VAULT_ADDRESS?.trim();

  if (!address || !isAddress(address)) {
    throw new UsageHttpError(
      503,
      "LANGCLAW_USAGE_VAULT_ADDRESS is not configured."
    );
  }

  return getAddress(address);
}

function firstRpcRow(value: unknown): UsageRpcRow | null {
  if (Array.isArray(value)) {
    return (value[0] as UsageRpcRow | undefined) ?? null;
  }

  return value && typeof value === "object" ? (value as UsageRpcRow) : null;
}

function readTxHash(value: unknown) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new UsageHttpError(400, "A valid txHash is required.");
  }

  return value as Hex;
}

function readOptionalBytes32(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new UsageHttpError(400, "reference must be a bytes32 hex string.");
  }

  return value as Hex;
}

function readNeuronString(value: unknown) {
  if (typeof value === "bigint") {
    return value >= 0n ? value.toString() : "";
  }

  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : "";
  }

  if (typeof value !== "string") {
    return "";
  }

  return /^\d+$/.test(value) ? value : "";
}

function readDecimalString(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.trunc(value)) : "0";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return value;
  }

  return "0";
}

function readUsageStatus(value: unknown): ModelUsageReceipt["status"] {
  return value === "estimated" ||
    value === "refunded" ||
    value === "failed_after_charge"
    ? value
    : "charged";
}

function readBoolean(value: unknown) {
  return value === true || value === "true";
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatNeuronAs0G(value: bigint) {
  const whole = value / neuronPer0G;
  const fraction = (value % neuronPer0G).toString().padStart(18, "0");
  const trimmed = fraction.replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}
