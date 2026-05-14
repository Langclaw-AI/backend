import {
  readWalletSession,
  writeWalletSession,
  type WalletSession,
} from "@/lib/chat-sessions";

type EthereumProvider = {
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const WALLET_CONNECT_TIMEOUT_MS = 15000;
const WALLET_SIGN_TIMEOUT_MS = 30000;

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function withWalletTimeout<T>(
  request: Promise<T>,
  timeoutMs: number,
  message: string
) {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([request, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getEthereumProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const ethereum = window.ethereum;

  if (!ethereum) {
    return null;
  }

  if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
    return (
      ethereum.providers.find((provider) => provider.isMetaMask) ??
      ethereum.providers.find((provider) => provider.isRabby) ??
      ethereum.providers.find((provider) => provider.isOkxWallet) ??
      ethereum.providers[0]
    );
  }

  return ethereum;
}

function readWalletAccounts(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function walletErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function requestWalletAddress() {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error(
      "Wallet extension not found. Open this app in a browser with MetaMask, Rabby, or OKX Wallet."
    );
  }

  const accounts = readWalletAccounts(
    await withWalletTimeout(
      provider.request({
        method: "eth_requestAccounts",
      }),
      WALLET_CONNECT_TIMEOUT_MS,
      "Wallet request timed out. Open your wallet extension and approve the connection."
    )
  );
  const address = accounts[0];

  if (!address) {
    throw new Error("No wallet account selected.");
  }

  const wallet = {
    address,
    connectedAt: new Date().toISOString(),
  } satisfies WalletSession;

  writeWalletSession(wallet);
  return wallet;
}

export async function signWalletSession(wallet = readWalletSession()) {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error(
      "Wallet extension not found. Open this app in a browser with MetaMask, Rabby, or OKX Wallet."
    );
  }

  const currentWallet = wallet ?? (await requestWalletAddress());
  const message = `Login to Langclaw\nAddress: ${currentWallet.address}\nTime: ${new Date().toISOString()}`;

  try {
    const signature = (await withWalletTimeout(
      provider.request({
        method: "personal_sign",
        params: [message, currentWallet.address],
      }),
      WALLET_SIGN_TIMEOUT_MS,
      "Signature request timed out. Open your wallet extension and approve the request."
    )) as string;

    const signedWallet = {
      address: currentWallet.address,
      connectedAt: currentWallet.connectedAt,
      message,
      signature,
    } satisfies WalletSession;

    writeWalletSession(signedWallet);
    return signedWallet;
  } catch (error) {
    throw new Error(
      walletErrorMessage(
        error,
        "Wallet connected. Sign message to continue."
      )
    );
  }
}

export async function requestWalletSession() {
  const wallet = readWalletSession();

  if (wallet?.message && wallet.signature) {
    return wallet;
  }

  const nextWallet = wallet ?? (await requestWalletAddress());

  return signWalletSession(nextWallet);
}
