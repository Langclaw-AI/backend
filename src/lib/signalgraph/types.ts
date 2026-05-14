export type SourceType =
  | "x_post"
  | "github_repo"
  | "docs_page"
  | "hackquest_hackathon"
  | "hackquest_project";

export type ProviderName = "X" | "GitHub" | "Tavily" | "HackQuest";

export type SourceCard = {
  id: string;
  type: SourceType;
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  excerpt: string;
  metrics?: Record<string, string | number | undefined>;
  provider: ProviderName;
};

export type ProviderError = {
  provider: ProviderName;
  message: string;
};

export type ProviderResult = {
  sources: SourceCard[];
  errors: ProviderError[];
};

export type OrchestrationRuntime = "openclaw" | "typescript";

export type StepExecution =
  | "openclaw-agent"
  | "typescript-tool"
  | "0g-compute"
  | "0g-storage"
  | "0g-chain"
  | "deterministic-fallback";

export type OrchestrationStep = {
  agent: string;
  skill: string;
  status: "complete" | "failed";
  summary: string;
  execution?: StepExecution;
  model?: string;
  sessionId?: string;
  error?: string;
};

export type WorkflowProgressEvent = {
  stepId: string;
  agent: string;
  skill: string;
  status: "pending" | "running" | "complete" | "failed";
  summary: string;
  timestamp: string;
  execution?: StepExecution;
  model?: string;
  sessionId?: string;
  error?: string;
};

export type OrchestrationTrace = {
  runtime: OrchestrationRuntime;
  steps: OrchestrationStep[];
};

export type FinalConclusion = {
  headline: string;
  summary: string;
  keySignals: Array<{
    label: string;
    text: string;
    sourceId?: string;
  }>;
  recommendation: string;
  qualityNote: string;
  generatedBy: "Final Conclusion Agent";
};

export type FinalAnswer = {
  title: string;
  answer: string;
  bullets: string[];
  recommendation: string;
  caveat: string;
  generatedBy: "Final Conclusion Agent";
};

export type FinalAnswerMeta = {
  synthesis: "0g-compute" | "openclaw-ai" | "deterministic-fallback";
  execution?: StepExecution;
  model?: string;
  sessionId?: string;
  transport?: string;
  fallbackFrom?: string;
  error?: string;
};

export type PlannerOutput = {
  summary: string;
  providerPlan: Array<{
    provider: ProviderName;
    query: string;
    purpose: string;
  }>;
  scoringFocus: string[];
};

export type TrendOutput = {
  summary: string;
  topTrend: string;
  score: number;
  rankedTrends: Array<{
    label: string;
    score: number;
    why: string;
    sourceIds: string[];
  }>;
};

export type EvidenceOutput = {
  bundleSummary: string;
  storageStatus: ZeroGStorageStatus;
  evidenceUri: string;
  rootHash?: string;
  storageTxHash?: string;
  storageExplorerUrl?: string;
  error?: string;
  claimMap: Array<{
    claim: string;
    sourceIds: string[];
  }>;
};

export type VerifierOutput = {
  verificationSummary: string;
  unsupportedClaims: string[];
  briefHashInput: string;
  storageStatus: ZeroGStorageStatus;
  chainStatus: ZeroGChainStatus;
  chainTxHash?: string;
  chainExplorerUrl?: string;
  registryAddress?: string;
  error?: string;
};

export type AgentOutputs = {
  planner?: PlannerOutput;
  trend?: TrendOutput;
  evidence?: EvidenceOutput;
  verifier?: VerifierOutput;
};

export type DiscoverPayload = {
  topic: string;
  generatedAt: string;
  sources: SourceCard[];
  errors: ProviderError[];
  orchestration: OrchestrationTrace;
  finalConclusion: FinalConclusion;
  finalAnswer: FinalAnswer;
  finalAnswerMeta?: FinalAnswerMeta;
  agentOutputs?: AgentOutputs;
  zeroG?: ZeroGProof;
};

export type ZeroGStorageStatus = "prepared" | "uploaded" | "skipped" | "failed";

export type ZeroGChainStatus = "prepared" | "anchored" | "skipped" | "failed";

export type ZeroGComputeStatus = "used" | "skipped" | "failed";

export type ZeroGStorageProof = {
  status: ZeroGStorageStatus;
  evidenceUri: string;
  rootHash?: string;
  txHash?: string;
  explorerUrl?: string;
  indexerRpc?: string;
  error?: string;
};

export type ZeroGChainProof = {
  status: ZeroGChainStatus;
  briefHash: string;
  txHash?: string;
  explorerUrl?: string;
  registryAddress?: string;
  chainId?: number;
  error?: string;
};

export type ZeroGComputeProof = {
  status: ZeroGComputeStatus;
  model?: string;
  endpoint?: string;
  error?: string;
};

export type ZeroGProof = {
  storage: ZeroGStorageProof;
  chain: ZeroGChainProof;
  compute?: ZeroGComputeProof;
};
