import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import solc from "solc";

const rootDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
for (const path of [join(rootDir, ".env.local"), join(rootDir, ".env")]) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}

const contractPath = join(rootDir, "contracts", "SignalGraphRegistry.sol");
const rpcUrl =
  process.env.OG_CHAIN_RPC_URL ||
  process.env.OG_RPC_URL ||
  "https://evmrpc.0g.ai";
const chainId = Number.parseInt(process.env.OG_CHAIN_ID || "16661", 10);
const privateKey = normalizePrivateKey(
  process.env.OG_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY || ""
);

if (!privateKey) {
  throw new Error("Set OG_PRIVATE_KEY or OG_STORAGE_PRIVATE_KEY before deploying.");
}

const { abi, bytecode } = await compileContract();
const account = privateKeyToAccount(privateKey);
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
const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

console.log(`Deploying SignalGraphRegistry to chain ${chainId}.`);
const hash = await walletClient.deployContract({
  abi,
  account,
  bytecode,
});
console.log(`Deployment tx: ${hash}`);

const receipt = await waitForReceipt(hash);

if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment failed. Transaction: ${hash}`);
}

console.log(`SignalGraphRegistry: ${receipt.contractAddress}`);
console.log(`SIGNALGRAPH_REGISTRY_ADDRESS=${receipt.contractAddress}`);

async function waitForReceipt(hash) {
  try {
    return await publicClient.waitForTransactionReceipt({
      hash,
      pollingInterval: 2000,
      timeout: 180_000,
    });
  } catch {
    // Some 0G RPC responses surface a missing receipt once before indexing catches up.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);

      if (receipt) {
        return receipt;
      }

      await delay(3000);
    }
  }

  throw new Error(`Deployment receipt was not found. Transaction: ${hash}`);
}

async function compileContract() {
  const source = await readFile(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "SignalGraphRegistry.sol": {
        content: source,
      },
    },
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((item) => item.severity === "error") || [];

  if (errors.length) {
    throw new Error(errors.map((item) => item.formattedMessage).join("\n"));
  }

  const compiled = output.contracts?.["SignalGraphRegistry.sol"]?.SignalGraphRegistry;

  if (!compiled?.evm?.bytecode?.object) {
    throw new Error("SignalGraphRegistry bytecode was not produced.");
  }

  return {
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`,
  };
}

function normalizePrivateKey(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  return /^0x[a-fA-F0-9]{64}$/.test(prefixed) ? prefixed : "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
