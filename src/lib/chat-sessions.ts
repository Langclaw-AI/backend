import type { DiscoverPayload, WorkflowProgressEvent } from "./signalgraph/types";

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
