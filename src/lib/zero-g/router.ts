import { readPositiveInt } from "../signalgraph/openclaw-runner";
import { ethers } from "ethers";

export type RouterBillingTrace = {
  inputCostNeuron?: string;
  outputCostNeuron?: string;
  totalCostNeuron?: string;
};

export type RouterTrace = {
  requestId?: string;
  provider?: string;
  billing?: RouterBillingTrace;
  chatId?: string;
  teeVerified?: boolean | null;
};

export type RouterTeeVerification = {
  requested: boolean;
  routerVerified?: boolean | null;
  independentVerified?: boolean | null;
  status:
    | "not-requested"
    | "router-verified"
    | "router-unverified"
    | "router-missing"
    | "independent-verified"
    | "independent-failed"
    | "independent-unavailable"
    | "independent-error";
  chatId?: string;
  error?: string;
};

export type RouterTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  maxTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type RouterModel = {
  id: string;
  name?: string;
  type?: string;
  context_length?: number;
  max_completion_tokens?: number;
  supported_parameters?: string[];
  supported_formats?: string[];
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    [key: string]: string | undefined;
  };
  pricing_usd?: {
    prompt?: string;
    completion?: string;
    image?: string;
    [key: string]: string | undefined;
  };
  provider_count?: number;
  [key: string]: unknown;
};

export type RouterService = "audio" | "chat" | "image";

export type RouterJsonResult<T> = {
  data: T;
  headers: Headers;
  teeVerification?: RouterTeeVerification;
  trace?: RouterTrace;
  usage?: RouterTokenUsage;
};

export type RouterChatMessage = {
  role: "assistant" | "system" | "tool" | "user";
  content: unknown;
  [key: string]: unknown;
};

export type RouterChatRequest = {
  model: string;
  messages: RouterChatMessage[];
  stream?: boolean;
  provider?: Record<string, unknown>;
  verify_tee?: boolean;
  [key: string]: unknown;
};

export type RouterStreamResult = {
  answer: string;
  headers: Headers;
  teeVerification?: RouterTeeVerification;
  trace?: RouterTrace;
  usage?: RouterTokenUsage;
};

export type RouterModelSelection = {
  fallbackFrom?: string;
  modelHonored: boolean;
  requestedModel?: string;
  usedModel: string;
};

export class RouterHttpError extends Error {
  code?: string;
  requestId?: string;
  retryAfter?: string;
  status: number;
  type?: string;

  constructor({
    code,
    message,
    requestId,
    retryAfter,
    status,
    type,
  }: {
    code?: string;
    message: string;
    requestId?: string;
    retryAfter?: string;
    status: number;
    type?: string;
  }) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.status = status;
    this.type = type;
  }
}

type RouterModelsResponse = {
  data?: unknown;
};

type RouterProviderQuery = {
  model?: string;
  model_id?: string;
  service_type?: string;
};

type RouterFetchOptions = {
  auth?: boolean;
  body?: BodyInit;
  contentType?: string;
  method?: string;
  model?: string;
  signal?: AbortSignal;
  verifyTee?: boolean;
};

type RouterModelCache = {
  endpoint: string;
  fetchedAt: number;
  models: RouterModel[];
};

const defaultRouterUrl = "https://router-api.0g.ai/v1";
const defaultChatModel = "0GM-1.0-35B-A3B";
const defaultImageModel = "z-image";
const defaultAudioModel = "openai/whisper-large-v3";

let modelCache: RouterModelCache | null = null;

export function getRouterEndpoint() {
  return normalizeRouterUrl(
    process.env.OG_COMPUTE_ROUTER_URL || defaultRouterUrl
  );
}

export function getDefaultRouterModel(service: "audio" | "chat" | "image") {
  if (service === "audio") {
    return process.env.OG_AUDIO_MODEL?.trim() || defaultAudioModel;
  }

  if (service === "image") {
    return process.env.OG_IMAGE_MODEL?.trim() || defaultImageModel;
  }

  return (
    process.env.OG_DIRECT_CHAT_MODEL?.trim() ||
    process.env.OG_COMPUTE_MODEL?.trim() ||
    defaultChatModel
  );
}

export function isRouterInferenceEnabled() {
  return process.env.OG_COMPUTE_ENABLED === "true";
}

export function hasRouterApiKey() {
  return Boolean(process.env.OG_COMPUTE_API_KEY?.trim());
}

export function shouldRequestTeeVerification(value?: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
  }

  const defaultValue = process.env.LANGCLAW_TEE_VERIFY_DEFAULT
    ?.trim()
    .toLowerCase();

  return !["false", "0", "no", "off"].includes(defaultValue ?? "");
}

export async function listRouterModels() {
  const endpoint = getRouterEndpoint();
  const cacheSeconds = readPositiveInt(
    process.env.LANGCLAW_MODEL_PRICE_CACHE_SECONDS,
    300
  );

  if (
    modelCache &&
    modelCache.endpoint === endpoint &&
    Date.now() - modelCache.fetchedAt < cacheSeconds * 1000
  ) {
    return modelCache.models;
  }

  const result = await routerJson<RouterModelsResponse>("/models", {
    auth: false,
  });
  const rawModels = Array.isArray(result.data.data) ? result.data.data : [];
  const models = rawModels.map(normalizeModel).filter(Boolean) as RouterModel[];

  modelCache = {
    endpoint,
    fetchedAt: Date.now(),
    models,
  };

  return models;
}

export async function findRouterModel(modelId: string) {
  const models = await listRouterModels();

  return models.find((model) => model.id === modelId || model.name === modelId);
}

export function inferRouterModelService(
  model: RouterModel | undefined
): RouterService | undefined {
  const type = readString(model?.type).toLowerCase();

  if (!type) {
    return undefined;
  }

  if (
    [
      "chat",
      "chatbot",
      "language",
      "llm",
      "multimodal",
      "text-generation",
      "vision",
      "vision-language",
    ].includes(type)
  ) {
    return "chat";
  }

  if (
    [
      "image",
      "image-generation",
      "text-to-image",
      "text_to_image",
    ].includes(type)
  ) {
    return "image";
  }

  if (
    [
      "audio",
      "audio-transcription",
      "speech",
      "speech-to-text",
      "speech_to_text",
      "transcription",
    ].includes(type)
  ) {
    return "audio";
  }

  return undefined;
}

export function requireRouterModelForService({
  model,
  modelId,
  service,
}: {
  model: RouterModel | undefined;
  modelId: string;
  service: RouterService;
}) {
  if (!model) {
    throw new RouterHttpError({
      message: `Model ${modelId} is not available in the 0G Router catalog.`,
      status: 400,
      type: "invalid_request_error",
    });
  }

  const modelService = inferRouterModelService(model);

  if (modelService && modelService !== service) {
    throw new RouterHttpError({
      message: `Model ${model.id} is a ${model.type} model and cannot be used with the ${service} endpoint.`,
      status: 400,
      type: "invalid_request_error",
    });
  }

  return model;
}

export async function resolveRouterModelSelection({
  requestedModel,
  service,
}: {
  requestedModel?: unknown;
  service: "audio" | "chat" | "image";
}): Promise<RouterModelSelection> {
  const fallbackModel = getDefaultRouterModel(service);
  const requested = readString(requestedModel);

  if (!requested) {
    return {
      modelHonored: true,
      usedModel: fallbackModel,
    };
  }

  if (requested === fallbackModel) {
    return {
      modelHonored: true,
      requestedModel: requested,
      usedModel: fallbackModel,
    };
  }

  const match = await findRouterModel(requested).catch(() => undefined);

  const matchService = inferRouterModelService(match);

  if (match && matchService && matchService !== service) {
    return {
      fallbackFrom: requested,
      modelHonored: false,
      requestedModel: requested,
      usedModel: fallbackModel,
    };
  }

  if (match) {
    return {
      modelHonored: true,
      requestedModel: requested,
      usedModel: match.id,
    };
  }

  return {
    fallbackFrom: requested,
    modelHonored: false,
    requestedModel: requested,
    usedModel: fallbackModel,
  };
}

export async function listRouterProviders(query: RouterProviderQuery = {}) {
  const params = new URLSearchParams();

  if (query.model) {
    params.set("model", query.model);
  }

  if (query.model_id) {
    params.set("model_id", query.model_id);
  }

  if (query.service_type) {
    params.set("service_type", query.service_type);
  }

  return routerJson<unknown>(
    `/providers${params.size ? `?${params.toString()}` : ""}`,
    { auth: false }
  );
}

export async function chatCompletion(
  payload: RouterChatRequest,
  signal?: AbortSignal
) {
  requireRouterInference();

  return routerJson<unknown>("/chat/completions", {
    auth: true,
    body: JSON.stringify(payload),
    contentType: "application/json",
    method: "POST",
    model: payload.model,
    signal,
    verifyTee: payload.verify_tee === true,
  });
}

export async function streamChatCompletion({
  onDelta,
  payload,
  signal,
}: {
  onDelta?: (delta: string) => void;
  payload: RouterChatRequest;
  signal?: AbortSignal;
}): Promise<RouterStreamResult> {
  requireRouterInference();

  const response = await routerFetch("/chat/completions", {
    auth: true,
    body: JSON.stringify({
      ...payload,
      stream: true,
    }),
    contentType: "application/json",
    method: "POST",
    model: payload.model,
    signal,
    verifyTee: payload.verify_tee === true,
  });

  if (!response.body) {
    throw new RouterHttpError({
      message: "0G Router returned an empty streaming response.",
      status: 502,
    });
  }

  const parsed = await readStreamingAnswer(response.body, onDelta);
  const chatId = readResponseChatId(response.headers, parsed.data);
  const trace = attachTraceChatId(parsed.trace, chatId);
  const teeVerification = await verifyRouterTeeResponse({
    chatId,
    content: parsed.answer,
    data: parsed.data,
    headers: response.headers,
    model: payload.model,
    requested: payload.verify_tee === true,
    trace,
  });

  return {
    answer: parsed.answer.trim(),
    headers: response.headers,
    teeVerification,
    trace,
    usage: parsed.usage,
  };
}

export async function generateImage(
  payload: Record<string, unknown>,
  signal?: AbortSignal
) {
  requireRouterInference();

  return routerJson<unknown>("/images/generations", {
    auth: true,
    body: JSON.stringify({
      ...payload,
      response_format: "b64_json",
    }),
    contentType: "application/json",
    method: "POST",
    model: readString(payload.model),
    signal,
    verifyTee: payload.verify_tee === true,
  });
}

export async function submitAsyncImageGeneration(
  payload: Record<string, unknown>,
  signal?: AbortSignal
) {
  requireRouterInference();

  return routerJson<unknown>("/async/images/generations", {
    auth: true,
    body: JSON.stringify({
      ...payload,
      response_format: "b64_json",
    }),
    contentType: "application/json",
    method: "POST",
    model: readString(payload.model),
    signal,
    verifyTee: payload.verify_tee === true,
  });
}

export async function readAsyncJob({
  jobId,
  model,
  providerAddress,
  signal,
  verifyTee,
}: {
  jobId: string;
  model?: string;
  providerAddress?: string;
  signal?: AbortSignal;
  verifyTee?: boolean;
}) {
  requireRouterInference();

  const params = new URLSearchParams();

  if (providerAddress) {
    params.set("provider_address", providerAddress);
  }

  if (model) {
    params.set("model", model);
  }

  if (verifyTee) {
    params.set("verify_tee", "true");
  }

  return routerJson<unknown>(
    `/async/jobs/${encodeURIComponent(jobId)}${
      params.size ? `?${params.toString()}` : ""
    }`,
    {
      auth: true,
      model,
      signal,
      verifyTee: verifyTee === true,
    }
  );
}

export async function transcribeAudio({
  formData,
  signal,
  verifyTee,
}: {
  formData: FormData;
  signal?: AbortSignal;
  verifyTee?: boolean;
}) {
  requireRouterInference();

  const params = new URLSearchParams();

  if (verifyTee) {
    params.set("verify_tee", "true");
  }

  return routerJson<unknown>(
    `/audio/transcriptions${params.size ? `?${params.toString()}` : ""}`,
    {
      auth: true,
      body: formData,
      method: "POST",
      model: readString(formData.get("model")),
      signal,
      verifyTee: verifyTee === true,
    }
  );
}

export async function readRouterAccountBalance() {
  requireRouterApiKey();

  return routerJson<unknown>("/account/balance", {
    auth: true,
  });
}

export async function readRouterUsageStats(queryString = "") {
  requireRouterApiKey();

  return routerJson<unknown>(
    `/account/usage/stats${queryString ? `?${queryString}` : ""}`,
    { auth: true }
  );
}

export async function readRouterUsageHistory(queryString = "") {
  requireRouterApiKey();

  return routerJson<unknown>(
    `/account/usage/history${queryString ? `?${queryString}` : ""}`,
    { auth: true }
  );
}

export function extractTextContent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as { choices?: unknown }).choices;

  if (!Array.isArray(choices)) {
    return "";
  }

  return readString(
    (choices[0] as { message?: { content?: unknown } } | undefined)?.message
      ?.content
  );
}

export function parseRouterTrace(payload: unknown): RouterTrace | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const trace = (payload as { x_0g_trace?: unknown }).x_0g_trace;

  if (!trace || typeof trace !== "object") {
    return undefined;
  }

  const record = trace as Record<string, unknown>;
  const billing = record.billing as Record<string, unknown> | undefined;
  const parsedBilling = billing
    ? {
        inputCostNeuron: readNeuronString(billing.input_cost),
        outputCostNeuron: readNeuronString(billing.output_cost),
        totalCostNeuron: readNeuronString(billing.total_cost),
      }
    : undefined;

  return {
    requestId: readString(record.request_id) || undefined,
    provider: readString(record.provider) || undefined,
    billing: parsedBilling,
    teeVerified:
      typeof record.tee_verified === "boolean"
        ? record.tee_verified
        : record.tee_verified === null
          ? null
          : undefined,
  };
}

export function assertTrustedTeeVerification(
  verification: RouterTeeVerification | undefined
) {
  if (!verification?.requested || !shouldFailClosedTee()) {
    return;
  }

  if (
    verification.status === "router-verified" ||
    verification.status === "independent-verified"
  ) {
    return;
  }

  throw new RouterHttpError({
    message:
      verification.error ||
      "0G Router TEE verification did not produce a trusted response.",
    status: 502,
    type: "tee_verification_error",
  });
}

export function parseRouterUsage(payload: unknown): RouterTokenUsage | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const usage = (payload as { usage?: unknown }).usage;

  if (!usage || typeof usage !== "object") {
    return undefined;
  }

  const record = usage as Record<string, unknown>;
  const promptTokens = readNonNegativeInt(record.prompt_tokens);
  const completionTokens = readNonNegativeInt(record.completion_tokens);
  const totalTokens = readNonNegativeInt(record.total_tokens);
  const promptDetails =
    record.prompt_tokens_details && typeof record.prompt_tokens_details === "object"
      ? (record.prompt_tokens_details as Record<string, unknown>)
      : undefined;
  const completionDetails =
    record.completion_tokens_details &&
    typeof record.completion_tokens_details === "object"
      ? (record.completion_tokens_details as Record<string, unknown>)
      : undefined;
  const cachedInputTokens = readNonNegativeInt(promptDetails?.cached_tokens);
  const reasoningTokens = readNonNegativeInt(
    completionDetails?.reasoning_tokens
  );
  const maxTokens = readNonNegativeInt(record.max_tokens);

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined &&
    cachedInputTokens === undefined &&
    reasoningTokens === undefined &&
    maxTokens === undefined
  ) {
    return undefined;
  }

  return {
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    reasoningTokens,
    cachedInputTokens,
    maxTokens,
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

export function requireSupportedRouterParameters(
  model: RouterModel | undefined,
  parameters: string[]
) {
  if (!model?.supported_parameters?.length) {
    return;
  }

  const supported = new Set(model.supported_parameters);
  const unsupported = parameters.filter((parameter) => !supported.has(parameter));

  if (unsupported.length) {
    throw new RouterHttpError({
      message: `Model ${model.id} does not support: ${unsupported.join(", ")}.`,
      status: 400,
      type: "invalid_request_error",
    });
  }
}

export function routerErrorResponse(error: unknown) {
  if (error instanceof RouterHttpError) {
    const headers = new Headers();

    if (error.retryAfter) {
      headers.set("Retry-After", error.retryAfter);
    }

    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId: error.requestId,
          type: error.type,
        },
      },
      {
        headers,
        status: error.status,
      }
    );
  }

  return Response.json(
    {
      error: {
        message:
          error instanceof Error ? error.message : "0G Router request failed.",
      },
    },
    { status: 500 }
  );
}

async function routerJson<T>(
  path: string,
  options: RouterFetchOptions = {}
): Promise<RouterJsonResult<T>> {
  const response = await routerFetch(path, options);
  const data = (await response.json().catch(() => null)) as T;
  const chatId = readResponseChatId(response.headers, data);
  const trace = parseRouterTrace(data);
  const traceWithChatId = attachTraceChatId(trace, chatId);
  const teeVerification = await verifyRouterTeeResponse({
    chatId,
    content: extractTextContent(data) || stringifyVerificationContent(data),
    data,
    headers: response.headers,
    model: options.model,
    requested: options.verifyTee === true,
    trace: traceWithChatId,
  });

  return {
    data,
    headers: response.headers,
    teeVerification,
    trace: traceWithChatId,
    usage: parseRouterUsage(data),
  };
}

async function routerFetch(path: string, options: RouterFetchOptions = {}) {
  const endpoint = getRouterEndpoint();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInt(process.env.OG_COMPUTE_TIMEOUT_SECONDS, 90) * 1000
  );
  const abort = () => controller.abort();

  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(`${endpoint}${path}`, {
      body: options.body,
      headers: buildHeaders(options),
      method: options.method || "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw buildRouterError(response, payload);
    }

    return response;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function verifyRouterTeeResponse({
  chatId,
  content,
  data,
  model,
  requested,
  trace,
}: {
  chatId?: string;
  content?: string;
  data?: unknown;
  headers: Headers;
  model?: string;
  requested: boolean;
  trace?: RouterTrace;
}): Promise<RouterTeeVerification | undefined> {
  if (!requested) {
    return undefined;
  }

  const base: RouterTeeVerification = {
    requested: true,
    chatId,
    routerVerified: trace?.teeVerified,
    status: readRouterTeeStatus(trace?.teeVerified),
  };

  if (trace?.teeVerified === false) {
    assertTrustedTeeVerification(base);

    return base;
  }

  if (shouldRunIndependentTeeVerification()) {
    const independent = await verifyIndependentTeeResponse({
      chatId,
      content,
      data,
      model,
      provider: trace?.provider,
    });
    const merged = {
      ...base,
      ...independent,
    };

    assertTrustedTeeVerification(merged);

    return merged;
  }

  assertTrustedTeeVerification(base);

  return base;
}

function readRouterTeeStatus(
  value: boolean | null | undefined
): RouterTeeVerification["status"] {
  if (value === true) {
    return "router-verified";
  }

  if (value === false) {
    return "router-unverified";
  }

  return "router-missing";
}

function attachTraceChatId(
  trace: RouterTrace | undefined,
  chatId: string | undefined
) {
  const resolvedChatId = chatId || trace?.chatId;

  if (!trace && !resolvedChatId) {
    return undefined;
  }

  return resolvedChatId
    ? {
        ...trace,
        chatId: resolvedChatId,
      }
    : trace;
}

async function verifyIndependentTeeResponse({
  chatId,
  content,
  data,
  model,
  provider,
}: {
  chatId?: string;
  content?: string;
  data?: unknown;
  model?: string;
  provider?: string;
}): Promise<Partial<RouterTeeVerification>> {
  if (!provider || !chatId) {
    return {
      error:
        "Independent TEE verification requires provider address and ZG-Res-Key chat ID.",
      independentVerified: null,
      status: "independent-unavailable",
    };
  }

  try {
    const { createZGComputeNetworkBroker } = await import(
      "@0gfoundation/0g-compute-ts-sdk"
    );
    const rpcUrl =
      process.env.OG_TEE_RPC_URL ||
      process.env.OG_CHAIN_RPC_URL ||
      process.env.ZERO_G_RPC_URL ||
      "https://evmrpc.0g.ai";
    const randomWallet = ethers.Wallet.createRandom();
    const wallet = new ethers.Wallet(
      randomWallet.privateKey,
      new ethers.JsonRpcProvider(rpcUrl)
    );
    const broker = await createZGComputeNetworkBroker(wallet);
    const verified = await broker.inference.processResponse(provider, chatId);

    return {
      independentVerified: verified,
      status:
        verified === true
          ? "independent-verified"
          : verified === false
            ? "independent-failed"
            : "independent-unavailable",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Independent TEE verification failed.",
      independentVerified: false,
      status: "independent-error",
    };
  }
}

function shouldRunIndependentTeeVerification() {
  return process.env.LANGCLAW_TEE_INDEPENDENT_VERIFY === "true";
}

function shouldFailClosedTee() {
  const value = process.env.LANGCLAW_TEE_FAIL_CLOSED?.trim().toLowerCase();

  return !["false", "0", "no", "off"].includes(value ?? "");
}

function readResponseChatId(headers: Headers, data: unknown) {
  return (
    headers.get("ZG-Res-Key") ||
    headers.get("zg-res-key") ||
    readString(
      data && typeof data === "object"
        ? (data as { id?: unknown }).id
        : undefined
    ) ||
    undefined
  );
}

function stringifyVerificationContent(value: unknown, model?: string) {
  if (!value || typeof value !== "object") {
    return model ? JSON.stringify({ model }) : "";
  }

  const record = value as Record<string, unknown>;
  const usage = record.usage;

  return JSON.stringify({
    id: readString(record.id) || undefined,
    model: readString(record.model) || model || undefined,
    usage: usage && typeof usage === "object" ? usage : undefined,
  });
}

function buildHeaders(options: RouterFetchOptions) {
  const headers = new Headers();

  if (options.contentType) {
    headers.set("Content-Type", options.contentType);
  }

  if (options.auth !== false) {
    const apiKey = process.env.OG_COMPUTE_API_KEY?.trim();

    if (apiKey) {
      headers.set("Authorization", `Bearer ${apiKey}`);
    }
  }

  return headers;
}

function buildRouterError(response: Response, payload: unknown) {
  const error =
    payload && typeof payload === "object"
      ? (payload as { error?: Record<string, unknown>; request_id?: unknown })
      : undefined;
  const detail = error?.error;

  return new RouterHttpError({
    code: readString(detail?.code) || undefined,
    message:
      readString(detail?.message) ||
      `0G Router returned HTTP ${response.status}.`,
    requestId: readString(error?.request_id) || undefined,
    retryAfter: response.headers.get("Retry-After") || undefined,
    status: response.status,
    type: readString(detail?.type) || undefined,
  });
}

function requireRouterInference() {
  if (!isRouterInferenceEnabled()) {
    throw new RouterHttpError({
      message: "OG_COMPUTE_ENABLED is not true.",
      status: 503,
    });
  }

  requireRouterApiKey();
}

function requireRouterApiKey() {
  if (!hasRouterApiKey()) {
    throw new RouterHttpError({
      message: "OG_COMPUTE_API_KEY is empty.",
      status: 503,
    });
  }
}

function normalizeModel(value: unknown): RouterModel | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record.id);

  if (!id) {
    return null;
  }

  return {
    ...record,
    id,
    name: readString(record.name) || undefined,
    pricing: normalizePricing(record.pricing),
    pricing_usd: normalizePricing(record.pricing_usd),
    supported_parameters: Array.isArray(record.supported_parameters)
      ? record.supported_parameters
          .map((item) => readString(item))
          .filter(Boolean)
      : undefined,
    supported_formats: Array.isArray(record.supported_formats)
      ? record.supported_formats
          .map((item) => readString(item))
          .filter(Boolean)
      : undefined,
  } as RouterModel;
}

function normalizePricing(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, string>
  >((acc, [key, item]) => {
    const parsed = readString(item);

    if (parsed) {
      acc[key] = parsed;
    }

    return acc;
  }, {});
}

async function readStreamingAnswer(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let answer = "";
  let buffer = "";
  let data: unknown;
  let trace: RouterTrace | undefined;
  let usage: RouterTokenUsage | undefined;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = readStreamLine(line);

      if (!parsed) {
        continue;
      }

      if (parsed.delta) {
        answer += parsed.delta;
        onDelta?.(parsed.delta);
      }

      data = parsed.data || data;
      trace = parsed.trace || trace;
      usage = parsed.usage || usage;
    }
  }

  const parsed = readStreamLine(buffer);

  if (parsed?.delta) {
    answer += parsed.delta;
    onDelta?.(parsed.delta);
  }

  return {
    answer,
    data: parsed?.data || data,
    trace: parsed?.trace || trace,
    usage: parsed?.usage || usage,
  };
}

function readStreamLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const data = trimmed.startsWith("data:")
    ? trimmed.slice("data:".length).trim()
    : trimmed;

  if (!data || data === "[DONE]") {
    return null;
  }

  try {
    const payload = JSON.parse(data) as Record<string, unknown>;
    const choices = payload.choices;
    const delta =
      Array.isArray(choices) && choices[0]
        ? readContentString(
            (choices[0] as { delta?: { content?: unknown } }).delta?.content
          ) ||
          readContentString(
            (choices[0] as { message?: { content?: unknown } }).message
              ?.content
          )
        : "";

    return {
      data: payload,
      delta,
      trace: parseRouterTrace(payload),
      usage: parseRouterUsage(payload),
    };
  } catch {
    return null;
  }
}

function readNeuronString(value: unknown) {
  const text = readString(value);

  return /^\d+$/.test(text) ? text : undefined;
}

function readNonNegativeInt(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readContentString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeRouterUrl(value: string) {
  return value.replace(/\/+$/, "");
}
