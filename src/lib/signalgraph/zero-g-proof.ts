import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ZgFile as ZgFileHandle } from "@0gfoundation/0g-storage-ts-sdk";

import { sanitizeError } from "./openclaw-runner";
import type {
  AgentOutputs,
  FinalAnswer,
  FinalConclusion,
  OrchestrationStep,
  ProviderError,
  SourceCard,
  ZeroGChainProof,
  ZeroGProof,
  ZeroGStorageProof,
} from "./types";

type PersistProofInput = {
  runId: string;
  topic: string;
  generatedAt: string;
  sources: SourceCard[];
  errors: ProviderError[];
  steps: OrchestrationStep[];
  finalConclusion: FinalConclusion;
  finalAnswer: FinalAnswer;
  agentOutputs: AgentOutputs;
};

type StorageUploadResult =
  | {
      txHash: string;
      rootHash: string;
      txSeq: number;
    }
  | {
      txHashes: string[];
      rootHashes: string[];
      txSeqs: number[];
    };

const defaultTestnetRpc = "https://evmrpc-testnet.0g.ai";
const defaultStorageIndexer = "https://indexer-storage-testnet-turbo.0g.ai";
const defaultChainExplorer = "https://chainscan-galileo.0g.ai";
const defaultStorageExplorer = "https://storagescan-galileo.0g.ai";
const defaultChainId = 16602;

const signalGraphRegistryAbi = [
  {
    type: "function",
    name: "registerBrief",
    stateMutability: "nonpayable",
    inputs: [
      { name: "briefHash", type: "bytes32" },
      { name: "storageUri", type: "string" },
    ],
    outputs: [{ name: "briefId", type: "uint256" }],
  },
] as const;

export async function persistSignalGraphProof(
  input: PersistProofInput
): Promise<ZeroGProof> {
  const evidenceBundle = buildEvidenceBundle(input);
  const canonicalBundle = stableStringify(evidenceBundle);
  const briefHash = keccak256(toBytes(canonicalBundle));
  const storage = await uploadEvidenceBundle({
    runId: input.runId,
    topic: input.topic,
    canonicalBundle,
    briefHash,
  });
  const chain = await anchorBrief({
    briefHash,
    storageUri: storage.evidenceUri,
    storageUploaded: storage.status === "uploaded",
  });

  return {
    storage,
    chain,
  };
}

function buildEvidenceBundle(input: PersistProofInput) {
  return {
    schema: "signalgraph.evidence.v1",
    runId: input.runId,
    topic: input.topic,
    generatedAt: input.generatedAt,
    sources: input.sources,
    providerErrors: input.errors,
    orchestrationSteps: input.steps,
    agentOutputs: input.agentOutputs,
    finalConclusion: input.finalConclusion,
    finalAnswer: input.finalAnswer,
  };
}

async function uploadEvidenceBundle({
  runId,
  topic,
  canonicalBundle,
  briefHash,
}: {
  runId: string;
  topic: string;
  canonicalBundle: string;
  briefHash: Hex;
}): Promise<ZeroGStorageProof> {
  const preparedUri = `0g://storage/signalgraph/${briefHash.slice(2, 14)}-prepared`;
  const indexerRpc =
    process.env.OG_STORAGE_INDEXER_RPC?.trim() || defaultStorageIndexer;
  const evmRpc =
    process.env.OG_STORAGE_RPC_URL?.trim() ||
    process.env.OG_RPC_URL?.trim() ||
    defaultTestnetRpc;
  const privateKey = readPrivateKey();

  if (process.env.OG_STORAGE_ENABLED !== "true") {
    return {
      status: "prepared",
      evidenceUri: preparedUri,
      indexerRpc,
      error: "OG_STORAGE_ENABLED is not true.",
    };
  }

  if (!privateKey) {
    return {
      status: "prepared",
      evidenceUri: preparedUri,
      indexerRpc,
      error: "Set OG_STORAGE_PRIVATE_KEY or OG_PRIVATE_KEY to upload the evidence bundle.",
    };
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "signalgraph-0g-"));
  const filePath = join(tmpDir, `${safeFilePart(topic)}-${runId}.json`);
  let file: ZgFileHandle | undefined;

  try {
    await writeFile(filePath, canonicalBundle, "utf8");

    const [{ Indexer, ZgFile }, { ethers }] = await Promise.all([
      import("@0gfoundation/0g-storage-ts-sdk"),
      import("ethers"),
    ]);
    const provider = new ethers.JsonRpcProvider(evmRpc);
    const signer = new ethers.Wallet(privateKey, provider);
    const indexer = new Indexer(indexerRpc);

    file = await ZgFile.fromFilePath(filePath);
    const [tree, treeError] = await file.merkleTree();

    if (treeError || !tree?.rootHash()) {
      throw treeError || new Error("0G Storage SDK could not compute a root hash.");
    }

    const [uploadResult, uploadError] = await indexer.upload(file, evmRpc, signer);

    if (uploadError) {
      throw uploadError;
    }

    const normalized = normalizeStorageUpload(uploadResult);
    const rootHash = normalized.rootHash || tree.rootHash() || briefHash;
    const txHash = normalized.txHash;

    return {
      status: "uploaded",
      evidenceUri: `0g://storage/${rootHash}`,
      rootHash,
      txHash,
      explorerUrl: txHash
        ? `${trimSlash(process.env.OG_STORAGE_EXPLORER_URL || defaultStorageExplorer)}/tx/${txHash}`
        : undefined,
      indexerRpc,
    };
  } catch (error) {
    return {
      status: "failed",
      evidenceUri: preparedUri,
      indexerRpc,
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    };
  } finally {
    await file?.close().catch(() => undefined);
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function anchorBrief({
  briefHash,
  storageUri,
  storageUploaded,
}: {
  briefHash: Hex;
  storageUri: string;
  storageUploaded: boolean;
}): Promise<ZeroGChainProof> {
  const rpcUrl =
    process.env.OG_CHAIN_RPC_URL?.trim() ||
    process.env.OG_RPC_URL?.trim() ||
    defaultTestnetRpc;
  const chainId = readChainId();
  const explorerBase = trimSlash(
    process.env.OG_CHAIN_EXPLORER_URL || defaultChainExplorer
  );
  const privateKey = readPrivateKey();
  const registryAddress = process.env.SIGNALGRAPH_REGISTRY_ADDRESS?.trim();

  if (process.env.OG_CHAIN_ENABLED !== "true") {
    return {
      status: "prepared",
      briefHash,
      chainId,
      registryAddress,
      error: "OG_CHAIN_ENABLED is not true.",
    };
  }

  if (!storageUploaded && process.env.OG_CHAIN_ALLOW_PREPARED_URI !== "true") {
    return {
      status: "prepared",
      briefHash,
      chainId,
      registryAddress,
      error: "0G Storage upload did not complete, so chain anchoring was not submitted.",
    };
  }

  if (!privateKey) {
    return {
      status: "prepared",
      briefHash,
      chainId,
      registryAddress,
      error: "Set OG_STORAGE_PRIVATE_KEY or OG_PRIVATE_KEY to anchor the brief hash.",
    };
  }

  if (!registryAddress || !isAddress(registryAddress)) {
    return {
      status: "prepared",
      briefHash,
      chainId,
      registryAddress,
      error: "Set SIGNALGRAPH_REGISTRY_ADDRESS to the deployed SignalGraphRegistry address.",
    };
  }

  try {
    const account = privateKeyToAccount(privateKey);
    const chain = defineChain({
      id: chainId,
      name: chainId === 16661 ? "0G Mainnet" : "0G Galileo Testnet",
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
    const address = getAddress(registryAddress) as Address;
    const { request } = await publicClient.simulateContract({
      address,
      abi: signalGraphRegistryAbi,
      functionName: "registerBrief",
      args: [briefHash, storageUri],
      account,
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== "success") {
      throw new Error(`0G Chain transaction ${txHash} reverted.`);
    }

    return {
      status: "anchored",
      briefHash,
      txHash,
      explorerUrl: `${explorerBase}/tx/${txHash}`,
      registryAddress: address,
      chainId,
    };
  } catch (error) {
    return {
      status: "failed",
      briefHash,
      chainId,
      registryAddress,
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    };
  }
}

function normalizeStorageUpload(uploadResult: StorageUploadResult) {
  if ("txHash" in uploadResult) {
    return {
      txHash: uploadResult.txHash,
      rootHash: uploadResult.rootHash,
    };
  }

  return {
    txHash: uploadResult.txHashes[0],
    rootHash: uploadResult.rootHashes[0],
  };
}

function readPrivateKey(): Hex | undefined {
  const raw =
    process.env.OG_PRIVATE_KEY?.trim() ||
    process.env.OG_STORAGE_PRIVATE_KEY?.trim();

  if (!raw) {
    return undefined;
  }

  const prefixed = raw.startsWith("0x") ? raw : `0x${raw}`;

  return /^0x[a-fA-F0-9]{64}$/.test(prefixed) ? (prefixed as Hex) : undefined;
}

function readChainId() {
  const parsed = Number.parseInt(process.env.OG_CHAIN_ID || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultChainId;
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "topic";
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const item = record[key];

        if (item !== undefined) {
          acc[key] = sortJson(item);
        }

        return acc;
      }, {});
  }

  return value;
}
