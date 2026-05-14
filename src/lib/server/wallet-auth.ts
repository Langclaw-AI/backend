import { getAddress, verifyMessage } from "viem";

export type WalletAuthInput = {
  address?: unknown;
  message?: unknown;
  signature?: unknown;
};

export type VerifiedWallet = {
  address: string;
  message: string;
  signature: string;
};

const WALLET_LOGIN_PREFIX = "Login to Langclaw";
const MAX_WALLET_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function verifyWalletSession(
  wallet: WalletAuthInput
): Promise<VerifiedWallet | null> {
  if (
    typeof wallet.address !== "string" ||
    typeof wallet.message !== "string" ||
    typeof wallet.signature !== "string"
  ) {
    return null;
  }

  let checksumAddress: string;

  try {
    checksumAddress = getAddress(wallet.address);
  } catch {
    return null;
  }

  if (!wallet.message.startsWith(WALLET_LOGIN_PREFIX)) {
    return null;
  }

  const messageAddress = wallet.message
    .split("\n")
    .find((line) => line.startsWith("Address: "))
    ?.replace("Address: ", "")
    .trim();

  if (!messageAddress) {
    return null;
  }

  try {
    if (getAddress(messageAddress) !== checksumAddress) {
      return null;
    }
  } catch {
    return null;
  }

  const messageTime = wallet.message
    .split("\n")
    .find((line) => line.startsWith("Time: "))
    ?.replace("Time: ", "")
    .trim();
  const signedAt = messageTime ? new Date(messageTime).getTime() : Number.NaN;

  if (
    Number.isNaN(signedAt) ||
    Date.now() - signedAt > MAX_WALLET_SESSION_AGE_MS ||
    signedAt - Date.now() > 5 * 60 * 1000
  ) {
    return null;
  }

  const valid = await verifyMessage({
    address: checksumAddress,
    message: wallet.message,
    signature: wallet.signature as `0x${string}`,
  });

  if (!valid) {
    return null;
  }

  return {
    address: checksumAddress.toLowerCase(),
    message: wallet.message,
    signature: wallet.signature,
  };
}
