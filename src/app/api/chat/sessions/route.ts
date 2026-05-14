import { NextResponse } from "next/server";

import type { ChatSession, StoredChatMessage } from "@/lib/chat-sessions";
import { verifyWalletSession, type WalletAuthInput } from "@/lib/server/wallet-auth";
import type { Json } from "@/lib/supabase/database.types";
import {
  getSupabaseAdmin,
  getSupabaseConfigStatus,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type ChatSessionsBody = {
  action?: unknown;
  wallet?: WalletAuthInput;
  sessionId?: unknown;
  session?: unknown;
};

type WalletUserRow = {
  id: string;
};

type ChatSessionRow = {
  id: string;
  title: string;
  pinned: boolean | null;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  role: "assistant" | "user";
  content: string;
  result: Json | null;
  direct_answer: Json | null;
  progress_events: Json | null;
  error: string | null;
  stopped: boolean | null;
  created_at: string;
};

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const config = getSupabaseConfigStatus();

  if (!supabase) {
    return NextResponse.json({
      configured: false,
      error: config.hasUrl
        ? "SUPABASE_SERVICE_ROLE_KEY is missing."
        : "Supabase URL and service role key are missing.",
    });
  }

  let body: ChatSessionsBody;

  try {
    body = (await request.json()) as ChatSessionsBody;
  } catch {
    return NextResponse.json(
      { configured: true, error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const wallet = await verifyWalletSession(body.wallet ?? {});

  if (!wallet) {
    return NextResponse.json(
      { configured: true, error: "Wallet signature is required." },
      { status: 401 }
    );
  }

  const walletUser = await upsertWalletUser(wallet);

  if (!walletUser) {
    return NextResponse.json(
      { configured: true, error: "Unable to sync wallet session." },
      { status: 500 }
    );
  }

  if (body.action === "list") {
    const { data, error } = await supabase
      .from("langclaw_chat_sessions")
      .select("id,title,pinned,created_at,updated_at")
      .eq("wallet_user_id", walletUser.id)
      .order("updated_at", { ascending: false })
      .limit(40);

    if (error) {
      return NextResponse.json(
        { configured: true, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      configured: true,
      sessions: ((data ?? []) as ChatSessionRow[]).map((row) =>
        rowToSession(row)
      ),
    });
  }

  if (body.action === "get") {
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

    if (!sessionId) {
      return NextResponse.json(
        { configured: true, error: "sessionId is required." },
        { status: 400 }
      );
    }

    const session = await readSession(walletUser.id, sessionId);

    return NextResponse.json({
      configured: true,
      session,
    });
  }

  if (body.action === "delete") {
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

    if (!sessionId) {
      return NextResponse.json(
        { configured: true, error: "sessionId is required." },
        { status: 400 }
      );
    }

    const existing = await readSessionOwner(sessionId);

    if (existing && existing.wallet_user_id !== walletUser.id) {
      return NextResponse.json(
        { configured: true, error: "Session belongs to another wallet." },
        { status: 403 }
      );
    }

    if (existing) {
      const deleted = await deleteSession(walletUser.id, sessionId);

      if (!deleted) {
        return NextResponse.json(
          { configured: true, error: "Unable to delete chat session." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      configured: true,
      deleted: true,
    });
  }

  if (body.action === "upsert") {
    const session = normalizeSession(body.session);

    if (!session) {
      return NextResponse.json(
        { configured: true, error: "A valid session is required." },
        { status: 400 }
      );
    }

    const existing = await readSessionOwner(session.id);

    if (existing && existing.wallet_user_id !== walletUser.id) {
      return NextResponse.json(
        { configured: true, error: "Session belongs to another wallet." },
        { status: 403 }
      );
    }

    const saved = await upsertSession(walletUser.id, session);

    if (!saved) {
      return NextResponse.json(
        { configured: true, error: "Unable to save chat session." },
        { status: 500 }
      );
    }

    if (session.messages.some((message) => message.result)) {
      await upsertResearchRuns(walletUser.id, session);
    }

    return NextResponse.json({
      configured: true,
      session: saved,
    });
  }

  return NextResponse.json(
    { configured: true, error: "Unsupported action." },
    { status: 400 }
  );
}

async function upsertWalletUser(wallet: {
  address: string;
  message: string;
  signature: string;
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("langclaw_wallet_users")
    .upsert(
      {
        wallet_address: wallet.address,
        last_login_message: wallet.message,
        last_seen_at: new Date().toISOString(),
        last_signature: wallet.signature,
      },
      { onConflict: "wallet_address" }
    )
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return data as WalletUserRow;
}

async function readSessionOwner(sessionId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("langclaw_chat_sessions")
    .select("wallet_user_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as { wallet_user_id: string };
}

async function readSession(walletUserId: string, sessionId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("langclaw_chat_sessions")
    .select("id,title,pinned,created_at,updated_at")
    .eq("wallet_user_id", walletUserId)
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return null;
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("langclaw_chat_messages")
    .select(
      "id,role,content,result,direct_answer,progress_events,error,stopped,created_at"
    )
    .eq("wallet_user_id", walletUserId)
    .eq("session_id", sessionId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (messagesError) {
    return rowToSession(sessionRow as ChatSessionRow);
  }

  return rowToSession(
    sessionRow as ChatSessionRow,
    ((messageRows ?? []) as ChatMessageRow[]).map(rowToMessage)
  );
}

async function upsertSession(walletUserId: string, session: ChatSession) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { error: sessionError } = await supabase
    .from("langclaw_chat_sessions")
    .upsert(
      {
        created_at: session.createdAt,
        id: session.id,
        pinned: Boolean(session.pinned),
        title: session.title,
        updated_at: session.updatedAt,
        wallet_user_id: walletUserId,
      },
      { onConflict: "id" }
    );

  if (sessionError) {
    return null;
  }

  const { error: deleteError } = await supabase
    .from("langclaw_chat_messages")
    .delete()
    .eq("wallet_user_id", walletUserId)
    .eq("session_id", session.id);

  if (deleteError) {
    return null;
  }

  if (session.messages.length) {
    const { error: insertError } = await supabase
      .from("langclaw_chat_messages")
      .insert(
        session.messages.map((message, position) => ({
          content: message.content,
          created_at: session.updatedAt,
          direct_answer: toJson(message.directAnswer),
          error: message.error ?? null,
          id: message.id,
          position,
          progress_events: toJson(message.progressEvents),
          result: toJson(message.result),
          role: message.role,
          session_id: session.id,
          stopped: Boolean(message.stopped),
          wallet_user_id: walletUserId,
        }))
      );

    if (insertError) {
      return null;
    }
  }

  return readSession(walletUserId, session.id);
}

async function deleteSession(walletUserId: string, sessionId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from("langclaw_chat_sessions")
    .delete()
    .eq("wallet_user_id", walletUserId)
    .eq("id", sessionId);

  return !error;
}

async function upsertResearchRuns(walletUserId: string, session: ChatSession) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return;
  }

  const rows = session.messages
    .filter((message) => message.role === "assistant" && message.result)
    .map((message) => ({
      message_id: message.id,
      proof: toJson(message.result?.zeroG),
      result: toJson(message.result),
      session_id: session.id,
      topic: message.result?.topic ?? session.title,
      wallet_user_id: walletUserId,
    }));

  if (!rows.length) {
    return;
  }

  await supabase.from("langclaw_research_runs").upsert(rows, {
    onConflict: "message_id",
  });
}

function rowToSession(
  row: ChatSessionRow,
  messages: StoredChatMessage[] = []
): ChatSession {
  return {
    createdAt: row.created_at,
    id: row.id,
    messages,
    pinned: Boolean(row.pinned),
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: ChatMessageRow): StoredChatMessage {
  return {
    content: row.content,
    directAnswer: (row.direct_answer as StoredChatMessage["directAnswer"]) ?? undefined,
    error: row.error ?? undefined,
    id: row.id,
    progressEvents:
      (row.progress_events as StoredChatMessage["progressEvents"]) ?? undefined,
    result: (row.result as StoredChatMessage["result"]) ?? undefined,
    role: row.role,
    stopped: Boolean(row.stopped),
  };
}

function normalizeSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<ChatSession>;

  if (
    typeof session.id !== "string" ||
    typeof session.title !== "string" ||
    typeof session.createdAt !== "string" ||
    typeof session.updatedAt !== "string" ||
    !Array.isArray(session.messages)
  ) {
    return null;
  }

  const messages = session.messages
    .map(normalizeMessage)
    .filter((message): message is StoredChatMessage => Boolean(message));

  return {
    createdAt: session.createdAt,
    id: session.id,
    messages,
    pinned: Boolean(session.pinned),
    title: session.title,
    updatedAt: session.updatedAt,
  };
}

function toJson(value: unknown): Json | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Json;
}

function normalizeMessage(value: unknown): StoredChatMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as Partial<StoredChatMessage>;

  if (
    typeof message.id !== "string" ||
    (message.role !== "assistant" && message.role !== "user") ||
    typeof message.content !== "string"
  ) {
    return null;
  }

  return {
    content: message.content,
    directAnswer: message.directAnswer,
    error: typeof message.error === "string" ? message.error : undefined,
    id: message.id,
    progressEvents: Array.isArray(message.progressEvents)
      ? message.progressEvents
      : undefined,
    result: message.result,
    role: message.role,
    stopped: Boolean(message.stopped),
  };
}
