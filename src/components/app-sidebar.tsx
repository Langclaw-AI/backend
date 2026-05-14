"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  deleteChatSession,
  deleteRemoteChatSession,
  formatShortAddress,
  mergeRemoteChatSessions,
  normalizeWalletSession,
  readChatSessions,
  readWalletSession,
  SESSIONS_CHANGED_EVENT,
  setChatSessionPinned,
  syncChatSessionToRemote,
  WALLET_CONNECTED_EVENT,
  WALLET_CHANGED_EVENT,
  type ChatSession,
  type WalletSession,
  writeWalletSession,
} from "@/lib/chat-sessions";
import { requestWalletAddress } from "@/lib/wallet-client";
import {
  Cable,
  CalendarSync,
  ChevronDown,
  CircleFadingPlus,
  Cpu,
  Database,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Settings,
  Trash2,
  User2,
  Wallet,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function formatSessionTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [walletError, setWalletError] = useState("");
  const [walletConnecting, setWalletConnecting] = useState(false);

  useEffect(() => {
    const refreshSessions = () => setSessions(readChatSessions());

    refreshSessions();
    window.addEventListener(SESSIONS_CHANGED_EVENT, refreshSessions);

    return () => {
      window.removeEventListener(SESSIONS_CHANGED_EVENT, refreshSessions);
    };
  }, []);

  useEffect(() => {
    const refreshWallet = () => {
      const currentWallet = readWalletSession();

      setWallet(currentWallet);

      if (currentWallet?.message && currentWallet.signature) {
        void syncExistingSessions(currentWallet);
      }
    };

    const applyExternalWallet = (event: Event) => {
      const externalWallet = normalizeWalletSession(
        event instanceof CustomEvent ? event.detail : null
      );

      if (externalWallet) {
        writeWalletSession(externalWallet);
      }
    };

    refreshWallet();
    window.addEventListener(WALLET_CHANGED_EVENT, refreshWallet);
    window.addEventListener(WALLET_CONNECTED_EVENT, applyExternalWallet);

    return () => {
      window.removeEventListener(WALLET_CHANGED_EVENT, refreshWallet);
      window.removeEventListener(WALLET_CONNECTED_EVENT, applyExternalWallet);
    };
  }, []);

  const pinnedSessions = useMemo(
    () => sessions.filter((session) => session.pinned).slice(0, 5),
    [sessions]
  );
  const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions]);

  async function syncExistingSessions(nextWallet: WalletSession) {
    await Promise.allSettled(
      readChatSessions().map((session) =>
        syncChatSessionToRemote(session, nextWallet)
      )
    );
    await mergeRemoteChatSessions(nextWallet);
    setSessions(readChatSessions());
  }

  async function connectWallet() {
    setWalletError("");

    if (walletConnecting) {
      return;
    }

    setWalletConnecting(true);

    try {
      const nextWallet = await requestWalletAddress();
      setWallet(nextWallet);
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : "Wallet login failed."
      );
    } finally {
      setWalletConnecting(false);
    }
  }

  function disconnectWallet() {
    writeWalletSession(null);
    setWallet(null);
    setWalletError("");
  }

  function removeSession(session: ChatSession) {
    if (!window.confirm(`Delete "${session.title}"?`)) {
      return;
    }

    deleteChatSession(session.id);
    setSessions(readChatSessions());

    const currentWallet = readWalletSession();

    if (currentWallet?.message && currentWallet.signature) {
      void deleteRemoteChatSession(session.id, currentWallet);
    }

    if (pathname === `/chat/${session.id}`) {
      router.push("/chat");
    }
  }

  function togglePinned(session: ChatSession) {
    const updatedSession = setChatSessionPinned(session.id, !session.pinned);

    if (!updatedSession) {
      return;
    }

    setSessions(readChatSessions());

    const currentWallet = readWalletSession();

    if (currentWallet?.message && currentWallet.signature) {
      void syncChatSessionToRemote(updatedSession, currentWallet);
    }
  }

  function renderSessionItem(session: ChatSession, showTime: boolean) {
    return (
      <SidebarMenuItem key={session.id}>
        <SidebarMenuButton asChild>
          <Link href={`/chat/${session.id}`}>
            <MessagesSquare />
            <span>{session.title}</span>
            {showTime ? (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {formatSessionTime(session.updatedAt)}
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              aria-label={`Open actions for ${session.title}`}
              showOnHover
              title="Chat actions"
              type="button"
            >
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                togglePinned(session);
              }}
            >
              {session.pinned ? <PinOff /> : <Pin />}
              <span>{session.pinned ? "Unpin chat" : "Pin chat"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                removeSession(session);
              }}
            >
              <Trash2 />
              <span>Delete chat</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={"/"}>
          <span className="text-lg font-bold mb-5">Langclaw.ai</span>
        </Link>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/chat">
              <CircleFadingPlus />
              <span>New Chat</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/task">
              <CalendarSync />
              <span>Automation Task</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/usage">
              <Database />
              <span>Usage</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/key">
              <Cable />
              <span>API</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/memory">
              <Cpu />
              <span>Memory</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/settings">
              <Settings />
              <span>Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarContent>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Pinned
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {pinnedSessions.length ? (
                    pinnedSessions.map((session) =>
                      renderSessionItem(session, false)
                    )
                  ) : (
                    <SidebarMenuItem>
                      <span className="px-2 text-xs text-muted-foreground">
                        No pinned chats yet
                      </span>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Recents
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recentSessions.length ? (
                    recentSessions.map((session) =>
                      renderSessionItem(session, true)
                    )
                  ) : (
                    <SidebarMenuItem>
                      <span className="px-2 text-xs text-muted-foreground">
                        Start a chat to build history
                      </span>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {wallet ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <Wallet />
                    {formatShortAddress(wallet.address)}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Wallet />
                    <span>{formatShortAddress(wallet.address)}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      disconnectWallet();
                    }}
                  >
                    <LogOut />
                    <span>Disconnect Wallet</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                aria-busy={walletConnecting}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={walletConnecting}
                id="langclaw-connect-wallet-button"
                onClick={(event) => {
                  event.preventDefault();
                  void connectWallet();
                }}
                type="button"
              >
                <User2 />
                <span data-wallet-label>
                  {walletConnecting ? "Connecting..." : "Connect Wallet"}
                </span>
              </button>
            )}
            {walletError ? (
              <span className="mt-2 block px-2 text-xs text-destructive">
                {walletError}
              </span>
            ) : null}
            <span
              className="mt-2 hidden px-2 text-xs text-destructive"
              id="langclaw-wallet-error"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
