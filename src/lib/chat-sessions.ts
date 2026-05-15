import type { DiscoverPayload, WorkflowProgressEvent } from "./signalgraph/types";
import type { RouterTeeVerification } from "./zero-g/router";

export type DirectChatPayload = {
  answer: string;
  model?: string;
  requestedModel?: string;
  usedModel?: string;
  fallbackFrom?: string;
  modelHonored?: boolean;
  source?: "0g-compute" | "fallback";
  teeVerified?: boolean | null;
  teeVerification?: RouterTeeVerification;
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
