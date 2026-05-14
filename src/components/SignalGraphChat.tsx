"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { SparklesText } from "@/components/ui/sparkles-text";
import {
  APP_SETTINGS_CHANGED_EVENT,
  readAppSettings,
  type AppSettings,
} from "@/lib/app-settings";
import {
  type ChatSession,
  createChatSessionId,
  findChatSession,
  loadRemoteChatSession,
  makeChatTitle,
  readWalletSession,
  syncChatSessionToRemote,
  type DirectChatPayload,
  type StoredChatMessage,
  upsertChatSession,
} from "@/lib/chat-sessions";
import { requestWalletSession } from "@/lib/wallet-client";
import type {
  DiscoverPayload,
  ProviderName,
  StepExecution,
  WorkflowProgressEvent,
} from "@/lib/signalgraph/types";
import type { ChatStatus, FileUIPart } from "ai";
import {
  Activity,
  AlertTriangle,
  CheckIcon,
  CheckCircle2,
  Clock3,
  CopyIcon,
  ExternalLink,
  GlobeIcon,
  Loader2,
  RefreshCcwIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const models = [
  {
    chef: "0G",
    chefSlug: "alibaba",
    id: "qwen/qwen-2.5-7b-instruct",
    name: "0G Qwen 2.5 7B",
    providers: ["alibaba"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o",
    name: "GPT-4o",
    providers: ["openai", "azure"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providers: ["openai", "azure"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-opus-4-20250514",
    name: "Claude 4 Opus",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Google",
    chefSlug: "google",
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    providers: ["google"],
  },
];

type StreamChunk =
  | { type: "mode"; mode: "agent" | "direct" }
  | {
      type: "progress";
      event?: WorkflowProgressEvent;
      payload?: WorkflowProgressEvent;
    }
  | { type: "result"; payload: DiscoverPayload }
  | { type: "direct_delta"; delta: string }
  | { type: "direct"; payload: DirectChatPayload }
  | { type: "error"; error: string };

type SignalMessage = StoredChatMessage;

interface AttachmentItemProps {
  attachment: FileUIPart & { id: string };
  onRemove: (id: string) => void;
}

const AttachmentItem = memo(({ attachment, onRemove }: AttachmentItemProps) => {
  const handleRemove = useCallback(
    () => onRemove(attachment.id),
    [onRemove, attachment.id]
  );

  return (
    <Attachment data={attachment} key={attachment.id} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
});

AttachmentItem.displayName = "AttachmentItem";

interface ModelItemProps {
  m: (typeof models)[0];
  selectedModel: string;
  onSelect: (id: string) => void;
}

const ModelItem = memo(({ m, selectedModel, onSelect }: ModelItemProps) => {
  const handleSelect = useCallback(() => onSelect(m.id), [onSelect, m.id]);

  return (
    <ModelSelectorItem key={m.id} onSelect={handleSelect} value={m.id}>
      <ModelSelectorLogo provider={m.chefSlug} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {m.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {selectedModel === m.id ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  );
});

ModelItem.displayName = "ModelItem";

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => attachments.remove(id),
    [attachments]
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}-${random}`;
}

function providerLabel(provider: ProviderName) {
  return provider === "Tavily" ? "Docs" : provider;
}

function runtimeLabel(result?: DiscoverPayload) {
  if (!result) {
    return "Waiting";
  }

  return result.orchestration.runtime === "openclaw"
    ? "OpenClaw CLI"
    : "TypeScript adapter";
}

function synthesisLabel(result?: DiscoverPayload) {
  if (!result?.finalAnswerMeta) {
    return "Answer pending";
  }

  if (result.finalAnswerMeta.synthesis === "0g-compute") {
    return "0G Compute";
  }

  return result.finalAnswerMeta.synthesis === "openclaw-ai"
    ? "OpenClaw AI"
    : "Fallback";
}

function executionLabel(execution?: StepExecution) {
  if (execution === "openclaw-agent") {
    return "OpenClaw agent";
  }

  if (execution === "typescript-tool") {
    return "TypeScript tool";
  }

  if (execution === "0g-compute") {
    return "0G Compute";
  }

  if (execution === "0g-storage") {
    return "0G Storage";
  }

  if (execution === "0g-chain") {
    return "0G Chain";
  }

  return "Fallback";
}

function currentAgentMessage(event: WorkflowProgressEvent) {
  if (event.status === "running") {
    return `${event.agent} is running.`;
  }

  return event.summary;
}

function getCurrentAgent(events: WorkflowProgressEvent[] = []) {
  return (
    [...events].reverse().find((event) => event.status === "running") ??
    events[events.length - 1]
  );
}

function statusLabel(status: WorkflowProgressEvent["status"]) {
  if (status === "running") {
    return "Running";
  }

  if (status === "complete") {
    return "Done";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Queued";
}

function statusBadgeClass(status: WorkflowProgressEvent["status"]) {
  if (status === "running") {
    return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }

  if (status === "complete") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "failed") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function executionBadgeClass(execution?: StepExecution) {
  if (execution === "openclaw-agent") {
    return "border-primary/20 bg-primary/10 text-primary";
  }

  if (execution === "typescript-tool") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (
    execution === "0g-compute" ||
    execution === "0g-storage" ||
    execution === "0g-chain"
  ) {
    return "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300";
  }

  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function formatEventTime(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "now";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function AgentStatusIcon({
  status,
}: {
  status: WorkflowProgressEvent["status"];
}) {
  if (status === "running") {
    return <Loader2 className="size-4 animate-spin text-blue-600" />;
  }

  if (status === "complete") {
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  }

  if (status === "failed") {
    return <AlertTriangle className="size-4 text-destructive" />;
  }

  return <Clock3 className="size-4 text-muted-foreground" />;
}

function ThinkingDots() {
  return (
    <span aria-hidden className="inline-flex items-center gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
    </span>
  );
}

function mergeProgressEvent(
  events: WorkflowProgressEvent[] | undefined,
  event: WorkflowProgressEvent
) {
  const current = events ?? [];
  const exists = current.some((item) => item.stepId === event.stepId);

  if (!exists) {
    return [...current, event];
  }

  return current.map((item) => (item.stepId === event.stepId ? event : item));
}

function formatResult(result: DiscoverPayload, compact = false) {
  const answer = result.finalAnswer;

  if (compact) {
    return `## ${answer.title}

${answer.answer}

**Recommendation**
${answer.recommendation}`;
  }

  const bullets = answer.bullets.map((bullet) => `- ${bullet}`).join("\n");
  const sourceIndex = new Map(
    result.sources.map((source, index) => [source.id, index + 1])
  );
  const keySignals = result.finalConclusion.keySignals
    .map((signal) => {
      const index = signal.sourceId ? sourceIndex.get(signal.sourceId) : null;
      const citation = index ? ` [${index}]` : "";

      return `- **${signal.label}:** ${signal.text}${citation}`;
    })
    .join("\n");

  return `## ${answer.title}

${answer.answer}

${keySignals ? `**Key signals**\n${keySignals}\n\n` : ""}**Why this matters**
${bullets}

**Recommendation**
${answer.recommendation}

**Caveat**
${answer.caveat}`;
}

function formatDirectAnswer(answer: DirectChatPayload) {
  return answer.answer;
}

function formatMessageForCopy(message: SignalMessage) {
  if (message.result) {
    return formatResult(message.result);
  }

  if (message.directAnswer) {
    return formatDirectAnswer(message.directAnswer);
  }

  return message.content;
}

function contextMessagesForRequest(messages: SignalMessage[], nextUser: string) {
  return [
    ...messages
      .filter((message) => !message.progressEvents || message.result || message.directAnswer)
      .map((message) => ({
        role: message.role,
        content:
          message.result || message.directAnswer
            ? formatMessageForCopy(message)
            : message.content,
      })),
    { role: "user" as const, content: nextUser },
  ].slice(-12);
}

function SourceCards({ result }: { result: DiscoverPayload }) {
  if (!result.sources.length) {
    return null;
  }

  return (
    <section className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Sources</h3>
        <span className="text-xs text-muted-foreground">
          {result.sources.length} source cards
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {result.sources.slice(0, 6).map((source, index) => (
          <a
            className="rounded-lg border bg-background/80 p-3 text-sm transition-colors hover:bg-muted/40"
            href={source.url}
            key={source.id}
            rel="noreferrer"
            target="_blank"
          >
            <div className="flex items-start justify-between gap-3">
              <strong className="line-clamp-2">
                [{index + 1}] {source.title}
              </strong>
              <ExternalLink className="mt-0.5 size-3 shrink-0" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {providerLabel(source.provider)}
              {source.author ? ` - ${source.author}` : ""}
            </p>
            <p className="mt-2 line-clamp-3 text-muted-foreground">
              {source.excerpt}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

function LiveProcessingPanel({ events }: { events: WorkflowProgressEvent[] }) {
  const current = getCurrentAgent(events);
  const completedCount = events.filter(
    (event) => event.status === "complete"
  ).length;
  const failedCount = events.filter((event) => event.status === "failed").length;
  const activeStatus = current?.status ?? "pending";
  const activeExecution = current?.execution
    ? executionLabel(current.execution)
    : "Waiting";

  return (
    <section
      aria-live="polite"
      className="mt-4 rounded-lg border bg-background/80 p-4 text-sm shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <Activity className="size-3.5" />
            <span>Live Processing</span>
            {current?.status === "running" ? (
              <span className="inline-flex items-center gap-1 text-blue-600">
                Thinking <ThinkingDots />
              </span>
            ) : null}
          </div>
          <div>
            <h3 className="break-words text-base font-semibold">
              {current?.agent ?? "Langclaw Coordinator"}
            </h3>
            <p className="mt-1 text-muted-foreground">
              {current?.summary ?? "Waiting for the first workflow event."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {events.length ? `${completedCount}/${events.length} done` : "Starting"}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
              activeStatus
            )}`}
          >
            {statusLabel(activeStatus)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {events.length ? (
          events.map((event, index) => (
            <div
              className="rounded-lg border bg-muted/35 p-3"
              key={event.stepId}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                  <AgentStatusIcon status={event.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="break-words">
                      {index + 1}. {event.agent}
                    </strong>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                        event.status
                      )}`}
                    >
                      {statusLabel(event.status)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${executionBadgeClass(
                        event.execution
                      )}`}
                    >
                      {executionLabel(event.execution)}
                    </span>
                  </div>

                  <p className="mt-1 text-muted-foreground">{event.summary}</p>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>{event.skill}</span>
                    <span>{formatEventTime(event.timestamp)}</span>
                    {event.model ? <span>Model: {event.model}</span> : null}
                    {event.sessionId ? (
                      <span className="max-w-full break-all">
                        Session: {event.sessionId}
                      </span>
                    ) : null}
                  </div>

                  {event.error ? (
                    <p className="mt-2 break-words rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      {event.error}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border bg-muted/35 p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                <Loader2 className="size-4 animate-spin text-blue-600" />
              </div>
              <div>
                <strong>Preparing agent workflow</strong>
                <p className="mt-1 text-muted-foreground">
                  Langclaw will show each active agent as soon as it starts.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {failedCount ? (
        <p className="mt-3 text-xs text-destructive">
          {failedCount} step reported an issue. Langclaw will keep using the
          available fallback path.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Current execution: {activeExecution}
        </p>
      )}
    </section>
  );
}

function PromptComposer({
  disabled,
  model,
  onModelChange,
  onResearchModeChange,
  onStop,
  onSubmit,
  researchMode,
  status,
}: {
  disabled?: boolean;
  model: string;
  onModelChange: (id: string) => void;
  onResearchModeChange: (enabled: boolean) => void;
  onStop: () => void;
  onSubmit: (message: PromptInputMessage) => void;
  researchMode: boolean;
  status: ChatStatus;
}) {
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const selectedModelData = models.find((m) => m.id === model);

  const handleModelSelect = useCallback((id: string) => {
    onModelChange(id);
    setModelSelectorOpen(false);
  }, [onModelChange]);

  return (
    <PromptInputProvider>
      <PromptInput
        globalDrop
        multiple
        onSubmit={onSubmit}
        className="w-full max-w-2xl mx-auto relative"
      >
        <PromptInputAttachmentsDisplay />
        <PromptInputBody>
          <PromptInputTextarea disabled={disabled} />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
                <PromptInputActionAddScreenshot />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputButton
              aria-pressed={researchMode}
              className="shadow-none"
              disabled={disabled}
              onClick={(event) => {
                event.preventDefault();
                onResearchModeChange(!researchMode);
              }}
              style={{
                backgroundColor: researchMode
                  ? "rgba(124, 58, 237, 0.12)"
                  : "transparent",
                borderColor: researchMode
                  ? "rgba(124, 58, 237, 0.38)"
                  : "transparent",
                color: researchMode ? "#6d28d9" : "#71717a",
              }}
              type="button"
            >
              <GlobeIcon size={16} />
              <span>Research Trend</span>
            </PromptInputButton>
            <ModelSelector
              onOpenChange={setModelSelectorOpen}
              open={modelSelectorOpen}
            >
              <ModelSelectorTrigger asChild>
                <PromptInputButton>
                  {selectedModelData?.chefSlug && (
                    <ModelSelectorLogo provider={selectedModelData.chefSlug} />
                  )}
                  {selectedModelData?.name && (
                    <ModelSelectorName>
                      {selectedModelData.name}
                    </ModelSelectorName>
                  )}
                </PromptInputButton>
              </ModelSelectorTrigger>
              <ModelSelectorContent>
                <ModelSelectorInput placeholder="Search models..." />
                <ModelSelectorList>
                  <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                  {["0G", "OpenAI", "Anthropic", "Google"].map((chef) => (
                    <ModelSelectorGroup heading={chef} key={chef}>
                      {models
                        .filter((m) => m.chef === chef)
                        .map((m) => (
                          <ModelItem
                            key={m.id}
                            m={m}
                            onSelect={handleModelSelect}
                            selectedModel={model}
                          />
                        ))}
                    </ModelSelectorGroup>
                  ))}
                </ModelSelectorList>
              </ModelSelectorContent>
            </ModelSelector>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={disabled && status !== "submitted" && status !== "streaming"}
            onStop={onStop}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  );
}

function ResultDetails({
  result,
  settings,
}: {
  result: DiscoverPayload;
  settings: AppSettings;
}) {
  const proof = result.zeroG;
  const hasDetails = settings.showAgentTrace || settings.showProofPanel;

  if (!hasDetails) {
    return null;
  }

  return (
    <details className="mt-4 rounded-lg border bg-background/70 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Sources and Agent Trace
      </summary>
      <div className="mt-4 space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-4">
          <Stat label="Runtime" value={runtimeLabel(result)} />
          <Stat label="Answer" value={synthesisLabel(result)} />
          <Stat label="Sources" value={String(result.sources.length)} />
          <Stat label="Issues" value={String(result.errors.length)} />
        </div>

        {result.agentOutputs?.trend ? (
          <section className="space-y-2">
            <h3 className="font-semibold">Ranked Trend</h3>
            <div className="grid gap-2">
              {result.agentOutputs.trend.rankedTrends.map((trend) => (
                <div className="rounded-lg border bg-muted/40 p-3" key={trend.label}>
                  <div className="flex items-center justify-between gap-3">
                    <strong>{trend.label}</strong>
                    <span>{trend.score}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{trend.why}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {result.agentOutputs?.evidence ? (
          <section className="space-y-2">
            <h3 className="font-semibold">Claim Map</h3>
            <div className="grid gap-2">
              {result.agentOutputs.evidence.claimMap.map((claim) => (
                <div className="rounded-lg border bg-muted/40 p-3" key={claim.claim}>
                  <strong>{claim.claim}</strong>
                  <p className="mt-1 text-muted-foreground">
                    {claim.sourceIds.length
                      ? claim.sourceIds.join(", ")
                      : "Needs source support"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {result.agentOutputs?.verifier ? (
          <section className="space-y-2">
            <h3 className="font-semibold">Verifier Summary</h3>
            <p className="text-muted-foreground">
              {result.agentOutputs.verifier.verificationSummary}
            </p>
          </section>
        ) : null}

        {settings.showAgentTrace ? (
          <section className="space-y-2">
            <h3 className="font-semibold">OpenClaw Skill Trace</h3>
            <div className="grid gap-2">
              {result.orchestration.steps.map((step) => (
                <div
                  className="rounded-lg border bg-muted/40 p-3"
                  key={`${step.agent}-${step.skill}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{step.agent}</strong>
                    <span className="text-xs text-muted-foreground">
                      {step.status} - {executionLabel(step.execution)}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{step.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {settings.showProofPanel ? (
          <section className="space-y-2">
            <h3 className="font-semibold">0G Proof</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <ProofCard
                label="Compute"
                value={proof?.compute?.model ?? proof?.compute?.status ?? "Not reported"}
              />
              <ProofCard
                href={proof?.storage.explorerUrl}
                label="Storage"
                value={proof?.storage.txHash ?? proof?.storage.status ?? "Not reported"}
              />
              <ProofCard
                href={proof?.chain.explorerUrl}
                label="Chain"
                value={proof?.chain.txHash ?? proof?.chain.status ?? "Not reported"}
              />
              <ProofCard
                label="Brief Hash"
                value={proof?.chain.briefHash ?? "Not reported"}
              />
            </div>
          </section>
        ) : null}
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words">{value}</strong>
    </div>
  );
}

function ProofCard({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {href ? (
        <a
          className="mt-1 inline-flex max-w-full items-center gap-2 break-all font-medium"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {value}
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <strong className="mt-1 block break-all">{value}</strong>
      )}
    </div>
  );
}

function WalletPromptStatus({
  error,
  pending,
}: {
  error: string;
  pending: boolean;
}) {
  if (!error && !pending) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={`mx-auto max-w-2xl rounded-lg border px-3 py-2 text-sm ${
        error
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-primary/20 bg-primary/10 text-primary"
      }`}
    >
      {error || "Connect your wallet to continue."}
    </p>
  );
}

export default function SignalGraphChat({ sessionId }: { sessionId?: string }) {
  const [messages, setMessages] = useState<SignalMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    sessionId
  );
  const [selectedModel, setSelectedModel] = useState<string>(models[0].id);
  const [researchMode, setResearchMode] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    readAppSettings()
  );
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [walletPromptError, setWalletPromptError] = useState("");
  const [walletAuthPending, setWalletAuthPending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | undefined>(sessionId);
  const remoteSyncTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const isRunning = status === "submitted" || status === "streaming";
  const composerDisabled = isRunning || walletAuthPending;

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(
    () => () => {
      for (const timer of remoteSyncTimersRef.current.values()) {
        clearTimeout(timer);
      }

      remoteSyncTimersRef.current.clear();
    },
    []
  );

  useEffect(() => {
    const refreshSettings = () => setAppSettings(readAppSettings());

    refreshSettings();
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, refreshSettings);

    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, refreshSettings);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;

    if (!sessionId) {
      setMessages([]);
      setStatus("ready");
      return () => {
        cancelled = true;
      };
    }

    const session = findChatSession(sessionId);
    setMessages(session?.messages ?? []);
    setStatus("ready");

    void loadRemoteChatSession(sessionId).then((remote) => {
      if (cancelled || !remote.session) {
        return;
      }

      upsertChatSession(remote.session);
      setMessages(remote.session.messages);
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const queueRemoteSync = useCallback((session: ChatSession) => {
    const wallet = readWalletSession();

    if (!wallet?.message || !wallet.signature) {
      return;
    }

    const currentTimer = remoteSyncTimersRef.current.get(session.id);

    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    const timer = setTimeout(() => {
      remoteSyncTimersRef.current.delete(session.id);
      void syncChatSessionToRemote(session, wallet);
    }, 500);

    remoteSyncTimersRef.current.set(session.id, timer);
  }, []);

  const persistMessages = useCallback(
    (sessionIdToSave: string, nextMessages: SignalMessage[]) => {
      const existing = findChatSession(sessionIdToSave);
      const firstUserMessage = nextMessages.find(
        (message) => message.role === "user"
      );
      const now = new Date().toISOString();
      const session = {
        id: sessionIdToSave,
        title:
          existing?.title ??
          makeChatTitle(firstUserMessage?.content ?? "New chat"),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        pinned: existing?.pinned,
        messages: nextMessages,
      };

      upsertChatSession(session);
      queueRemoteSync(session);
    },
    [queueRemoteSync]
  );

  const updateAssistant = useCallback(
    (messageId: string, updater: (message: SignalMessage) => SignalMessage) => {
      setMessages((current) =>
        {
          const updated = current.map((message) =>
          message.id === messageId ? updater(message) : message
          );
          const sessionIdToSave = activeSessionIdRef.current;

          if (sessionIdToSave) {
            persistMessages(sessionIdToSave, updated);
          }

          return updated;
        }
      );
    },
    [persistMessages]
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("ready");

    const sessionIdToSave = activeSessionIdRef.current;

    setMessages((current) => {
      const updated = current.map((message, index) => {
        if (index !== current.length - 1 || message.role !== "assistant") {
          return message;
        }

        return {
          ...message,
          content: "Stopped by user.",
          error: "Generation stopped.",
          stopped: true,
        };
      });

      if (sessionIdToSave) {
        persistMessages(sessionIdToSave, updated);
      }

      return updated;
    });
  }, [persistMessages]);

  const runChat = useCallback(
    async (message: PromptInputMessage) => {
      const topic = message.text?.trim();

      if (!topic || isRunning || walletAuthPending) {
        return;
      }

      setWalletPromptError("");
      setWalletAuthPending(true);

      try {
        await requestWalletSession();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Wallet connection failed. Try again.";

        setWalletPromptError(message);
        setWalletAuthPending(false);
        throw new Error(message);
      }

      setWalletAuthPending(false);

      const shouldResearch = researchMode;
      const nextSessionId = activeSessionIdRef.current ?? createChatSessionId();
      const assistantId = createId("assistant");
      const userMessage: SignalMessage = {
        id: createId("user"),
        role: "user",
        content: topic,
      };
      const assistantMessage: SignalMessage = {
        id: assistantId,
        role: "assistant",
        content: shouldResearch ? "Preparing research agents." : "Thinking...",
      };
      const nextMessages = [...messages, userMessage, assistantMessage];
      const requestContext = contextMessagesForRequest(messages, topic);
      const abortController = new AbortController();

      abortControllerRef.current = abortController;
      activeSessionIdRef.current = nextSessionId;
      setActiveSessionId(nextSessionId);
      persistMessages(nextSessionId, nextMessages);

      if (!activeSessionId && typeof window !== "undefined") {
        window.history.replaceState(null, "", `/chat/${nextSessionId}`);
      }

      setStatus("submitted");
      setMessages(nextMessages);
      setResearchMode(false);

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: topic,
            messages: requestContext,
            model: selectedModel,
            researchTrend: shouldResearch,
            sessionId: nextSessionId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || "Langclaw chat failed.");
        }

        setStatus("streaming");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            processStreamLine(line, assistantId, updateAssistant);
          }
        }

        if (buffer.trim()) {
          processStreamLine(buffer, assistantId, updateAssistant);
        }

        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          updateAssistant(assistantId, (current) => ({
            ...current,
            content: "Stopped by user.",
            error: "Generation stopped.",
            stopped: true,
          }));
          setStatus("ready");
          return;
        }

        updateAssistant(assistantId, (current) => ({
          ...current,
          content: "Langclaw failed before the final answer was ready.",
          error:
            error instanceof Error ? error.message : "Discovery request failed.",
        }));
        setStatus("error");
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      activeSessionId,
      isRunning,
      messages,
      persistMessages,
      researchMode,
      selectedModel,
      updateAssistant,
      walletAuthPending,
    ]
  );

  if (!messages.length) {
    return (
      <div className="size-full mx-auto flex flex-col h-full justify-center items-center gap-10 px-4">
        <div className="flex flex-col items-center gap-2 text-center text-4xl md:flex-row md:items-end md:text-left">
          <span>Welcome to</span>
          <SparklesText className="text-5xl">Langclaw,</SparklesText>
          <span>how can I help?</span>
        </div>
        <WalletPromptStatus
          error={walletPromptError}
          pending={walletAuthPending}
        />
        <PromptComposer
          disabled={composerDisabled}
          model={selectedModel}
          onModelChange={setSelectedModel}
          onResearchModeChange={setResearchMode}
          onStop={stopGeneration}
          onSubmit={runChat}
          researchMode={researchMode}
          status={status}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto p-6 relative size-full rounded-lg">
      <div className="flex flex-col h-full">
        <Conversation>
          <ConversationContent>
            {messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent
                  className={
                    message.role === "assistant" ? "w-full max-w-full" : undefined
                  }
                >
                  {message.result ? (
                    <MessageResponse>
                      {formatResult(message.result, appSettings.compactAnswers)}
                    </MessageResponse>
                  ) : message.directAnswer ? (
                    <MessageResponse>
                      {formatDirectAnswer(message.directAnswer)}
                    </MessageResponse>
                  ) : message.role === "assistant" && message.progressEvents ? null : (
                    <MessageResponse>{message.content}</MessageResponse>
                  )}
                  {message.role === "assistant" &&
                  message.progressEvents &&
                  !message.result &&
                  appSettings.showAgentTrace ? (
                    <LiveProcessingPanel events={message.progressEvents} />
                  ) : null}
                  {message.error ? (
                    <p className="text-destructive text-sm">{message.error}</p>
                  ) : null}
                  {message.result ? (
                    <>
                      {appSettings.showSourceCards ? (
                        <SourceCards result={message.result} />
                      ) : null}
                      <ResultDetails
                        result={message.result}
                        settings={appSettings}
                      />
                    </>
                  ) : null}
                </MessageContent>
                {message.role === "assistant" ? (
                  <MessageActions>
                    <MessageAction
                      label="Retry"
                      onClick={() => {
                        const previousUser = [...messages]
                          .reverse()
                          .find((item) => item.role === "user");

                        if (previousUser) {
                          void runChat({
                            files: [],
                            text: previousUser.content,
                          }).catch(() => undefined);
                        }
                      }}
                    >
                      <RefreshCcwIcon className="size-3" />
                    </MessageAction>
                    <MessageAction
                      label="Copy"
                      onClick={() =>
                        navigator.clipboard.writeText(formatMessageForCopy(message))
                      }
                    >
                      <CopyIcon className="size-3" />
                    </MessageAction>
                  </MessageActions>
                ) : null}
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="mt-4">
          <WalletPromptStatus
            error={walletPromptError}
            pending={walletAuthPending}
          />
          <PromptComposer
            disabled={composerDisabled}
            model={selectedModel}
            onModelChange={setSelectedModel}
            onResearchModeChange={setResearchMode}
            onStop={stopGeneration}
            onSubmit={runChat}
            researchMode={researchMode}
            status={status}
          />
        </div>

        {latestAssistant?.result ? (
          <div className="sr-only">
            {runtimeLabel(latestAssistant.result)} {synthesisLabel(latestAssistant.result)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function processStreamLine(
  line: string,
  messageId: string,
  updateAssistant: (
    messageId: string,
    updater: (message: SignalMessage) => SignalMessage
  ) => void
) {
  if (!line.trim()) {
    return;
  }

  let chunk: StreamChunk;

  try {
    chunk = JSON.parse(line) as StreamChunk;
  } catch {
    updateAssistant(messageId, (message) => ({
      ...message,
      content: "Langclaw received an invalid stream chunk.",
      error: "Invalid stream payload.",
    }));
    return;
  }

  if (chunk.type === "mode") {
    updateAssistant(messageId, (message) => {
      if (chunk.mode === "direct") {
        return {
          ...message,
          content: "",
          progressEvents: undefined,
        };
      }

      return {
        ...message,
        content: "Preparing Langclaw agents.",
        progressEvents: message.progressEvents ?? [],
      };
    });
    return;
  }

  if (chunk.type === "direct_delta") {
    updateAssistant(messageId, (message) => ({
      ...message,
      content: `${message.content}${chunk.delta}`,
      progressEvents: undefined,
    }));
    return;
  }

  if (chunk.type === "progress") {
    const event = chunk.event ?? chunk.payload;

    if (!event) {
      updateAssistant(messageId, (message) => ({
        ...message,
        content: "Langclaw received an invalid progress event.",
        error: "Invalid progress payload.",
      }));
      return;
    }

    updateAssistant(messageId, (message) => {
      const progressEvents = mergeProgressEvent(
        message.progressEvents,
        event
      );

      return {
        ...message,
        content: currentAgentMessage(event),
        progressEvents,
      };
    });
    return;
  }

  if (chunk.type === "direct") {
    updateAssistant(messageId, (message) => ({
      ...message,
      content: chunk.payload.answer,
      directAnswer: chunk.payload,
      progressEvents: undefined,
    }));
    return;
  }

  if (chunk.type === "result") {
    updateAssistant(messageId, (message) => ({
      ...message,
      content: chunk.payload.finalAnswer.answer,
      result: chunk.payload,
    }));
    return;
  }

  updateAssistant(messageId, (message) => ({
    ...message,
    content: "Langclaw failed before the final result was ready.",
    error: chunk.error,
  }));
}
