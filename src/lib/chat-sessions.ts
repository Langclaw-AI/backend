import type { DiscoverPayload, WorkflowProgressEvent } from "@/lib/signalgraph/types";

export const SESSIONS_CHANGED_EVENT = "langclaw:sessions-changed";
export const WALLET_CHANGED_EVENT = "langclaw:wallet-changed";
export const WALLET_CONNECTED_EVENT = "langclaw:wallet-connected";

export type DirectChatPayload = {
  answer: string;
  model?: string;
  source?: "0g-compute" | "fallback";
  title?: string;
};

export type StoredChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  result?: DiscoverPayload;
  directAnswer?: DirectChatPayload;
  progressEvents?: WorkflowProgressEvent[];
  error?: string;
  stopped?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  messages: StoredChatMessage[];
};

export type WalletSession = {
  address: string;
  message?: string;
  signature?: string;
  connectedAt: string;
};

let currentChatSessions: ChatSession[] = [];
let currentWalletSession: WalletSession | null = null;

function normalizeSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<ChatSession>;

  if (
    typeof session.id !== "string" ||
    typeof session.title !== "string" ||
    !Array.isArray(session.messages)
  ) {
    return null;
  }

  return {
    id: session.id,
    title: session.title,
    createdAt:
      typeof session.createdAt === "string"
        ? session.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof session.updatedAt === "string"
        ? session.updatedAt
        : new Date().toISOString(),
    pinned: Boolean(session.pinned),
    messages: session.messages.filter(
      (message): message is StoredChatMessage =>
        Boolean(message) &&
        typeof message === "object" &&
        typeof (message as StoredChatMessage).id === "string" &&
        ((message as StoredChatMessage).role === "assistant" ||
          (message as StoredChatMessage).role === "user") &&
        typeof (message as StoredChatMessage).content === "string"
    ),
  };
}

export function createChatSessionId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `chat-${random}`;
}

export function readChatSessions(): ChatSession[] {
  return currentChatSessions
    .map((session) => ({
      ...session,
      messages: [...session.messages],
    }))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export function writeChatSessions(sessions: ChatSession[]) {
  currentChatSessions = sessions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 40);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSIONS_CHANGED_EVENT));
  }
}

export function upsertChatSession(session: ChatSession) {
  const sessions = readChatSessions();
  const nextSessions = [
    session,
    ...sessions.filter((item) => item.id !== session.id),
  ];

  writeChatSessions(nextSessions);
}

export function findChatSession(sessionId: string) {
  return readChatSessions().find((session) => session.id === sessionId);
}

export function updateChatSession(
  sessionId: string,
  updater: (session: ChatSession) => ChatSession
) {
  const sessions = readChatSessions();
  const session = sessions.find((item) => item.id === sessionId);

  if (!session) {
    return null;
  }

  const updatedSession = updater(session);

  writeChatSessions(
    sessions.map((item) => (item.id === sessionId ? updatedSession : item))
  );

  return updatedSession;
}

export function setChatSessionPinned(sessionId: string, pinned: boolean) {
  return updateChatSession(sessionId, (session) => ({
    ...session,
    pinned,
    updatedAt: new Date().toISOString(),
  }));
}

export function deleteChatSession(sessionId: string) {
  writeChatSessions(
    readChatSessions().filter((session) => session.id !== sessionId)
  );
}

function hasWalletProof(wallet?: WalletSession | null) {
  return Boolean(wallet?.address && wallet.message && wallet.signature);
}

export async function loadRemoteChatSessions(wallet = readWalletSession()) {
  if (!hasWalletProof(wallet)) {
    return { configured: false, sessions: [] as ChatSession[] };
  }

  const response = await fetch("/api/chat/sessions", {
    body: JSON.stringify({
      action: "list",
      wallet,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as {
    configured?: boolean;
    sessions?: ChatSession[];
  } | null;

  if (!response.ok || !payload?.configured) {
    return { configured: Boolean(payload?.configured), sessions: [] };
  }

  return {
    configured: true,
    sessions: Array.isArray(payload.sessions)
      ? payload.sessions
          .map(normalizeSession)
          .filter((session): session is ChatSession => Boolean(session))
      : [],
  };
}

export async function loadRemoteChatSession(
  sessionId: string,
  wallet = readWalletSession()
) {
  if (!hasWalletProof(wallet)) {
    return { configured: false, session: null as ChatSession | null };
  }

  const response = await fetch("/api/chat/sessions", {
    body: JSON.stringify({
      action: "get",
      sessionId,
      wallet,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as {
    configured?: boolean;
    session?: ChatSession | null;
  } | null;

  if (!response.ok || !payload?.configured || !payload.session) {
    return { configured: Boolean(payload?.configured), session: null };
  }

  return {
    configured: true,
    session: normalizeSession(payload.session),
  };
}

export async function syncChatSessionToRemote(
  session: ChatSession,
  wallet = readWalletSession()
) {
  if (!hasWalletProof(wallet)) {
    return { configured: false, session: null as ChatSession | null };
  }

  const response = await fetch("/api/chat/sessions", {
    body: JSON.stringify({
      action: "upsert",
      session,
      wallet,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as {
    configured?: boolean;
    session?: ChatSession | null;
  } | null;

  if (!response.ok || !payload?.configured || !payload.session) {
    return { configured: Boolean(payload?.configured), session: null };
  }

  return {
    configured: true,
    session: normalizeSession(payload.session),
  };
}

export async function deleteRemoteChatSession(
  sessionId: string,
  wallet = readWalletSession()
) {
  if (!hasWalletProof(wallet)) {
    return { configured: false, deleted: false };
  }

  const response = await fetch("/api/chat/sessions", {
    body: JSON.stringify({
      action: "delete",
      sessionId,
      wallet,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as {
    configured?: boolean;
    deleted?: boolean;
  } | null;

  if (!response.ok || !payload?.configured) {
    return { configured: Boolean(payload?.configured), deleted: false };
  }

  return {
    configured: true,
    deleted: Boolean(payload.deleted),
  };
}

export async function mergeRemoteChatSessions(wallet = readWalletSession()) {
  const remote = await loadRemoteChatSessions(wallet);

  if (!remote.configured || !remote.sessions.length) {
    return remote;
  }

  const localSessions = readChatSessions();
  const sessionMap = new Map<string, ChatSession>();

  for (const session of [...localSessions, ...remote.sessions]) {
    const current = sessionMap.get(session.id);

    if (
      !current ||
      new Date(session.updatedAt).getTime() >
        new Date(current.updatedAt).getTime()
    ) {
      sessionMap.set(session.id, {
        ...session,
        messages: session.messages.length
          ? session.messages
          : current?.messages ?? [],
      });
    }
  }

  const merged = [...sessionMap.values()];
  writeChatSessions(merged);

  return {
    configured: true,
    sessions: merged,
  };
}

export function makeChatTitle(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "New chat";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

export function formatShortAddress(address: string) {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function readWalletSession(): WalletSession | null {
  return currentWalletSession ? { ...currentWalletSession } : null;
}

export function normalizeWalletSession(value: unknown): WalletSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<WalletSession>;

  if (typeof parsed.address !== "string") {
    return null;
  }

  return {
    address: parsed.address,
    message: typeof parsed.message === "string" ? parsed.message : undefined,
    signature:
      typeof parsed.signature === "string" ? parsed.signature : undefined,
    connectedAt:
      typeof parsed.connectedAt === "string"
        ? parsed.connectedAt
        : new Date().toISOString(),
  };
}

export function writeWalletSession(session: WalletSession | null) {
  currentWalletSession = session ? { ...session } : null;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WALLET_CHANGED_EVENT));
  }
}
