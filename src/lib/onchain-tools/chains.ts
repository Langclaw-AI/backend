type ChainConfig = {
  aliases: string[];
  alchemyNetwork?: string;
  dexScreenerId: string;
  etherscanId: number;
  goPlusId: number;
  name: string;
};

export const defaultChain = "base";

const chains: Record<string, ChainConfig> = {
  arbitrum: {
    aliases: ["arb", "arbitrum one"],
    alchemyNetwork: "arb-mainnet",
    dexScreenerId: "arbitrum",
    etherscanId: 42161,
    goPlusId: 42161,
    name: "Arbitrum",
  },
  avalanche: {
    aliases: ["avax", "avalanche c-chain"],
    alchemyNetwork: "avax-mainnet",
    dexScreenerId: "avalanche",
    etherscanId: 43114,
    goPlusId: 43114,
    name: "Avalanche",
  },
  base: {
    aliases: ["base mainnet"],
    alchemyNetwork: "base-mainnet",
    dexScreenerId: "base",
    etherscanId: 8453,
    goPlusId: 8453,
    name: "Base",
  },
  bnb: {
    aliases: ["bsc", "binance", "binance smart chain"],
    dexScreenerId: "bsc",
    etherscanId: 56,
    goPlusId: 56,
    name: "BNB Smart Chain",
  },
  ethereum: {
    aliases: ["eth", "mainnet"],
    alchemyNetwork: "eth-mainnet",
    dexScreenerId: "ethereum",
    etherscanId: 1,
    goPlusId: 1,
    name: "Ethereum",
  },
  optimism: {
    aliases: ["op", "optimistic ethereum"],
    alchemyNetwork: "opt-mainnet",
    dexScreenerId: "optimism",
    etherscanId: 10,
    goPlusId: 10,
    name: "Optimism",
  },
  polygon: {
    aliases: ["matic", "polygon pos"],
    alchemyNetwork: "polygon-mainnet",
    dexScreenerId: "polygon",
    etherscanId: 137,
    goPlusId: 137,
    name: "Polygon",
  },
  solana: {
    aliases: ["sol"],
    dexScreenerId: "solana",
    etherscanId: 1,
    goPlusId: 501,
    name: "Solana",
  },
};

export function resolveChain(input: string | undefined) {
  const normalized = input?.trim().toLowerCase() || defaultChain;

  for (const [key, value] of Object.entries(chains)) {
    if (key === normalized || value.aliases.includes(normalized)) {
      return {
        id: key,
        ...value,
      };
    }
  }

  return {
    id: defaultChain,
    ...chains[defaultChain],
  };
}

export function detectChain(text: string) {
  const normalized = text.toLowerCase();

  for (const [key, value] of Object.entries(chains)) {
    if (
      new RegExp(`\\b${escapeRegExp(key)}\\b`, "i").test(normalized) ||
      value.aliases.some((alias) =>
        new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(normalized)
      )
    ) {
      return resolveChain(key);
    }
  }

  return resolveChain(defaultChain);
}

export function getAlchemyNetwork(chain: string) {
  return resolveChain(chain).alchemyNetwork;
}

export function getDexScreenerChainId(chain: string) {
  return resolveChain(chain).dexScreenerId;
}

export function getEtherscanChainId(chain: string) {
  return resolveChain(chain).etherscanId;
}

export function getGoPlusChainId(chain: string) {
  return resolveChain(chain).goPlusId;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
