import { detectChain } from "./chains";
import {
  getCommandsByDomain,
  onChainCommands,
  onChainDomainLabels,
} from "./registry";
import type {
  OnChainCommand,
  OnChainContextMessage,
  OnChainDomain,
  OnChainPlan,
  OnChainPlannedCommand,
} from "./types";
import { onChainDomains } from "./types";

const evmAddressPattern = /\b0x[a-fA-F0-9]{40}\b/;
const solanaAddressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

export function planOnChainTools({
  context,
  message,
}: {
  context: OnChainContextMessage[];
  message: string;
}): OnChainPlan {
  const text = buildPlanningText(message, context);
  const chain = detectChain(text);
  const addresses = extractAddresses(text);
  const intent = classifyIntent(text);
  const domains = selectDomains(text, intent);
  const query = buildQuery(message, addresses);
  const tokenAddress = inferTokenAddress(text, addresses);
  const walletAddress = inferWalletAddress(text, addresses, tokenAddress);
  const planned = selectCommands({
    domains,
    intent,
    query,
    tokenAddress,
    walletAddress,
  });

  return {
    chain: chain.id,
    chainId: chain.etherscanId,
    commands: planned,
    domainCount: onChainDomains.length,
    intent,
    query,
    registryCommandCount: onChainCommands.length,
    tokenAddress,
    walletAddress,
  };
}

export function summarizePlan(plan: OnChainPlan) {
  return {
    ...plan,
    commands: plan.commands.map(({ command, reason }) => ({
      commandId: command.id,
      domain: command.domain,
      provider: command.provider,
      reason,
      title: command.title,
    })),
  };
}

function selectDomains(text: string, intent: string): OnChainDomain[] {
  const normalized = text.toLowerCase();
  const domains = new Set<OnChainDomain>();

  if (/\b(trending|boost|new token|gem|discover|narrative|hot)\b/i.test(normalized)) {
    domains.add("token_discovery");
    domains.add("market_data");
    domains.add("social_sentiment");
  }

  if (/\b(price|market|volume|fdv|mcap|market cap|liquidity|pool|pair)\b/i.test(normalized)) {
    domains.add("market_data");
    domains.add("pair_liquidity");
  }

  if (/\b(wallet|portfolio|balance|address)\b/i.test(normalized)) {
    domains.add("wallet_portfolio");
    domains.add("address_approval_risk");
  }

  if (/\b(pnl|profit|loss|realized|unrealized)\b/i.test(normalized)) {
    domains.add("wallet_pnl");
  }

  if (/\b(smart money|whale|accumulat|holder|flow)\b/i.test(normalized)) {
    domains.add("smart_money");
  }

  if (/\b(tvl|defi|protocol)\b/i.test(normalized)) {
    domains.add("defi_tvl");
  }

  if (/\b(yield|apy|pool|stablecoin|farm)\b/i.test(normalized)) {
    domains.add("yield_pools");
  }

  if (/\b(security|audit|risk|rug|owner|mint|proxy)\b/i.test(normalized)) {
    domains.add("token_security");
  }

  if (/\b(honeypot|sell tax|buy tax|blacklist|cannot sell)\b/i.test(normalized)) {
    domains.add("honeypot_detection");
  }

  if (/\b(raw|tx|transaction|transfer|contract code|bytecode)\b/i.test(normalized)) {
    domains.add("raw_onchain_query");
  }

  if (/\b(signal|entry|exit|trade|trading|bullish|bearish)\b/i.test(normalized)) {
    domains.add("trading_signal_analysis");
  }

  if (!domains.size) {
    if (intent === "wallet") {
      domains.add("wallet_portfolio");
      domains.add("smart_money");
    } else {
      domains.add("token_discovery");
      domains.add("market_data");
      domains.add("token_security");
    }
  }

  return Array.from(domains).slice(0, 4);
}

function selectCommands({
  domains,
  intent,
  query,
  tokenAddress,
  walletAddress,
}: {
  domains: OnChainDomain[];
  intent: string;
  query?: string;
  tokenAddress?: string;
  walletAddress?: string;
}) {
  const candidates = domains.flatMap((domain) => getCommandsByDomain(domain));
  const selected: OnChainPlannedCommand[] = [];

  for (const command of candidates) {
    if (!canRun(command, { query, tokenAddress, walletAddress })) {
      continue;
    }

    selected.push({
      command,
      reason: reasonFor(command, intent),
    });

    if (selected.length >= 5) {
      break;
    }
  }

  const synthesis = onChainCommands.find(
    (command) => command.id === "trading_signal_analysis.trading_signal_synthesis"
  );

  if (synthesis && !selected.some((item) => item.command.id === synthesis.id)) {
    selected.push({
      command: synthesis,
      reason: "Synthesize the on-chain tool results into an analysis-only answer.",
    });
  }

  return selected.length ? selected : fallbackCommands(intent);
}

function fallbackCommands(intent: string) {
  const ids =
    intent === "wallet"
      ? [
          "wallet_portfolio.wallet_token_balances",
          "wallet_portfolio.wallet_recent_transfers",
          "wallet_portfolio.portfolio_signal_synthesis",
        ]
      : [
          "token_discovery.trending_boosted_tokens",
          "token_discovery.latest_token_profiles",
          "trading_signal_analysis.trading_signal_synthesis",
        ];

  return ids
    .map((id) => onChainCommands.find((command) => command.id === id))
    .filter((command): command is OnChainCommand => Boolean(command))
    .map((command) => ({
      command,
      reason: reasonFor(command, intent),
    }));
}

function canRun(
  command: OnChainCommand,
  values: { query?: string; tokenAddress?: string; walletAddress?: string }
) {
  const required = command.paramsSchema.required ?? [];

  return required.every((field) => {
    if (field === "query") {
      return Boolean(values.query);
    }

    if (field === "tokenAddress" || field === "pairAddress") {
      return Boolean(values.tokenAddress);
    }

    if (field === "walletAddress") {
      return Boolean(values.walletAddress);
    }

    if (field === "queryId") {
      return /\bquery\s+\d{3,12}\b/i.test(values.query ?? "") || Boolean(process.env.DUNE_DEFAULT_QUERY_ID);
    }

    return true;
  });
}

function reasonFor(command: OnChainCommand, intent: string) {
  const domain = onChainDomainLabels[command.domain];

  return `${domain} is relevant to the detected ${intent} intent.`;
}

function classifyIntent(text: string) {
  if (/\b(wallet|portfolio|balance|address|pnl|smart money|whale)\b/i.test(text)) {
    return "wallet";
  }

  if (/\b(tvl|yield|defi|stablecoin|protocol)\b/i.test(text)) {
    return "defi";
  }

  if (/\b(security|honeypot|audit|rug|risk|tax)\b/i.test(text)) {
    return "security";
  }

  if (/\b(signal|trade|trading|entry|exit)\b/i.test(text)) {
    return "trading-signal";
  }

  return "token-discovery";
}

function buildPlanningText(message: string, context: OnChainContextMessage[]) {
  const prior = [...context]
    .reverse()
    .slice(0, 4)
    .map((item) => item.content)
    .join(" ");

  return `${prior} ${message}`;
}

function extractAddresses(text: string) {
  const evm = Array.from(text.matchAll(new RegExp(evmAddressPattern, "g"))).map(
    (match) => match[0]
  );
  const solana = Array.from(text.matchAll(new RegExp(solanaAddressPattern, "g")))
    .map((match) => match[0])
    .filter((value) => !evm.includes(value));

  return [...evm, ...solana];
}

function inferTokenAddress(
  text: string,
  addresses: string[]
): string | undefined {
  if (!addresses.length) {
    return undefined;
  }

  if (/\b(wallet|portfolio|my address|smart money wallet)\b/i.test(text)) {
    return addresses[1];
  }

  return addresses[0];
}

function inferWalletAddress(
  text: string,
  addresses: string[],
  tokenAddress: string | undefined
): string | undefined {
  if (!addresses.length) {
    return undefined;
  }

  if (/\b(wallet|portfolio|my address|smart money wallet|pnl|balance)\b/i.test(text)) {
    return addresses[0];
  }

  return addresses.find((address) => address !== tokenAddress);
}

function buildQuery(message: string, addresses: string[]) {
  let query = message.trim();

  for (const address of addresses) {
    query = query.replace(address, " ");
  }

  query = query.replace(/\s+/g, " ").trim();

  return query || undefined;
}
