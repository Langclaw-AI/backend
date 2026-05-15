import { getEtherscanChainId } from "../chains";
import type { OnChainProviderResponse } from "../types";
import { compactText, fetchJson, requireEnv } from "./http";

const baseUrl = "https://api.etherscan.io/v2/api";

type EtherscanOptions = {
  chain: string;
  signal?: AbortSignal;
  tokenAddress?: string;
  walletAddress?: string;
};

export async function getAccountBalance(
  options: EtherscanOptions
): Promise<OnChainProviderResponse> {
  const walletAddress = requireWallet(options.walletAddress);
  const sourceUrl = buildUrl(options.chain, {
    action: "balance",
    address: walletAddress,
    module: "account",
    tag: "latest",
  });
  const data = await fetchJson(sourceUrl, { signal: options.signal });

  return {
    data,
    sourceUrl,
    summary: `Fetched native account balance for ${short(walletAddress)}. ${summarizeEtherscan(data)}`,
  };
}

export async function getTokenTransfers(
  options: EtherscanOptions
): Promise<OnChainProviderResponse> {
  const walletAddress = options.walletAddress;
  const tokenAddress = options.tokenAddress;

  if (!walletAddress && !tokenAddress) {
    throw new Error("A wallet address or token address is required.");
  }

  const params: Record<string, string> = {
    action: "tokentx",
    module: "account",
    offset: "20",
    page: "1",
    sort: "desc",
  };

  if (walletAddress) {
    params.address = walletAddress;
  }

  if (tokenAddress) {
    params.contractaddress = tokenAddress;
  }

  const sourceUrl = buildUrl(options.chain, params);
  const data = await fetchJson(sourceUrl, { signal: options.signal });

  return {
    data,
    sourceUrl,
    summary: `Fetched token transfer activity. ${summarizeEtherscan(data)}`,
  };
}

export async function getTxList(
  options: EtherscanOptions
): Promise<OnChainProviderResponse> {
  const walletAddress = requireWallet(options.walletAddress);
  const sourceUrl = buildUrl(options.chain, {
    action: "txlist",
    address: walletAddress,
    module: "account",
    offset: "20",
    page: "1",
    sort: "desc",
  });
  const data = await fetchJson(sourceUrl, { signal: options.signal });

  return {
    data,
    sourceUrl,
    summary: `Fetched recent account transactions for ${short(walletAddress)}. ${summarizeEtherscan(data)}`,
  };
}

export async function getTokenBalance(
  options: EtherscanOptions
): Promise<OnChainProviderResponse> {
  const walletAddress = requireWallet(options.walletAddress);
  const tokenAddress = requireToken(options.tokenAddress);
  const sourceUrl = buildUrl(options.chain, {
    action: "tokenbalance",
    address: walletAddress,
    contractaddress: tokenAddress,
    module: "account",
    tag: "latest",
  });
  const data = await fetchJson(sourceUrl, { signal: options.signal });

  return {
    data,
    sourceUrl,
    summary: `Fetched token balance for ${short(walletAddress)} and ${short(tokenAddress)}. ${summarizeEtherscan(data)}`,
  };
}

export async function getCode(
  options: EtherscanOptions
): Promise<OnChainProviderResponse> {
  const tokenAddress = requireToken(options.tokenAddress);
  const sourceUrl = buildUrl(options.chain, {
    action: "eth_getCode",
    address: tokenAddress,
    module: "proxy",
    tag: "latest",
  });
  const data = await fetchJson(sourceUrl, { signal: options.signal });

  return {
    data,
    sourceUrl,
    summary: `Fetched contract bytecode status for ${short(tokenAddress)}. ${summarizeEtherscan(data)}`,
  };
}

function buildUrl(chain: string, params: Record<string, string>) {
  const url = new URL(baseUrl);

  url.searchParams.set("chainid", String(getEtherscanChainId(chain)));
  url.searchParams.set("apikey", requireEnv("ETHERSCAN_API_KEY"));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function requireWallet(walletAddress: string | undefined) {
  if (!walletAddress) {
    throw new Error("A wallet address is required.");
  }

  return walletAddress;
}

function requireToken(tokenAddress: string | undefined) {
  if (!tokenAddress) {
    throw new Error("A token address is required.");
  }

  return tokenAddress;
}

function summarizeEtherscan(value: unknown) {
  if (!value || typeof value !== "object") {
    return compactText(value);
  }

  const record = value as { message?: unknown; result?: unknown; status?: unknown };
  const result = record.result;

  if (Array.isArray(result)) {
    return `${result.length} records returned.`;
  }

  if (typeof result === "string") {
    return `${String(record.message || "Result")}: ${result.slice(0, 80)}.`;
  }

  return compactText(value);
}

function short(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
