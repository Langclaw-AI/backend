import type { WalletAuthInput } from "../lib/server/wallet-auth";
import type { RouterTrace } from "../lib/zero-g/router";
import {
  chatCompletion,
  findRouterModel,
  generateImage,
  getDefaultRouterModel,
  listRouterModels,
  listRouterProviders,
  readAsyncJob,
  readRouterAccountBalance,
  readRouterUsageHistory,
  readRouterUsageStats,
  requireSupportedRouterParameters,
  requireRouterModelForService,
  routerErrorResponse,
  shouldRequestTeeVerification,
  streamChatCompletion,
  submitAsyncImageGeneration,
  transcribeAudio,
  type RouterModel,
} from "../lib/zero-g/router";
import {
  readUsageReservation,
  refundResearchUsage,
  reserveResearchUsage,
  settleResearchUsage,
  usageErrorResponse,
  type UsageReservation,
} from "../lib/usage";

type JsonBody = Record<string, unknown>;

const chatParameters = [
  "chat_template_kwargs",
  "frequency_penalty",
  "logit_bias",
  "max_tokens",
  "max_completion_tokens",
  "metadata",
  "n",
  "parallel_tool_calls",
  "presence_penalty",
  "preserve_thinking",
  "repetition_penalty",
  "response_format",
  "seed",
  "stop",
  "store",
  "temperature",
  "tool_choice",
  "tools",
  "top_k",
  "top_p",
  "user",
];
const imageParameters = ["n", "response_format", "size"];
const audioParameters = ["language", "prompt", "response_format", "temperature"];
const chatReservedKeys = [
  "messages",
  "model",
  "provider",
  "stream",
  "verify_tee",
  "wallet",
];
const imageReservedKeys = [
  "model",
  "prompt",
  "provider",
  "verify_tee",
  "wallet",
];
const audioReservedKeys = ["file", "model", "verify_tee", "wallet"];

export async function handleZeroGModels() {
  try {
    return Response.json({
      object: "list",
      data: await listRouterModels(),
    });
  } catch (error) {
    return routerErrorResponse(error);
  }
}

export async function handleZeroGProviders(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await listRouterProviders({
      model: url.searchParams.get("model") || undefined,
      model_id: url.searchParams.get("model_id") || undefined,
      service_type: url.searchParams.get("service_type") || undefined,
    });

    return Response.json(result.data);
  } catch (error) {
    return routerErrorResponse(error);
  }
}

export async function handleZeroGChatCompletions(request: Request) {
  let body: JsonBody;

  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const model = readString(body.model) || getDefaultRouterModel("chat");
  const messages = Array.isArray(body.messages) ? body.messages : null;

  if (!messages) {
    return Response.json(
      { error: "messages must be an array." },
      { status: 400 }
    );
  }

  let reservation: UsageReservation | undefined;

  try {
    const modelMeta = requireRouterModelForService({
      model: await findRouterModel(model),
      modelId: model,
      service: "chat",
    });
    const parameters = pickSupportedJsonParameters(
      modelMeta,
      body,
      chatParameters,
      chatReservedKeys
    );
    reservation = await reserveResearchUsage(readWallet(body), {
      estimatedCompletionTokens: readPositiveNumber(body.max_tokens),
      model,
      service: "chat",
    });
    const payload = {
      ...parameters,
      messages,
      model,
      provider: readProvider(body.provider),
      stream: body.stream === true,
      verify_tee: shouldRequestTeeVerification(body.verify_tee),
    };

    if (body.stream === true) {
      return streamChatResponse(payload, reservation, request.signal);
    }

    const result = await chatCompletion(payload, request.signal);
    const usage = await settleResearchUsage({
      computeStatus: "used",
      reservation,
      routerTrace: result.trace,
      tokenUsage: result.usage,
      topic: `0G chat completion: ${model}`,
    });

    return routerJsonResponse({
      ...asObject(result.data),
      usage,
    }, result.headers);
  } catch (error) {
    if (reservation) {
      await refundResearchUsage(
        reservation,
        error instanceof Error ? error.message : "0G chat completion failed."
      ).catch(() => undefined);
    }

    return mixedErrorResponse(error);
  }
}

export async function handleZeroGImageGeneration(request: Request) {
  let body: JsonBody;

  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const model = readString(body.model) || getDefaultRouterModel("image");
  const prompt = readString(body.prompt);
  const imageCount = readPositiveNumber(body.n) || 1;

  if (!prompt) {
    return Response.json({ error: "prompt is required." }, { status: 400 });
  }

  if (
    body.response_format !== undefined &&
    body.response_format !== "b64_json"
  ) {
    return Response.json(
      { error: "response_format must be b64_json." },
      { status: 400 }
    );
  }

  let reservation: UsageReservation | undefined;

  try {
    const modelMeta = requireRouterModelForService({
      model: await findRouterModel(model),
      modelId: model,
      service: "image",
    });
    const parameters = pickSupportedJsonParameters(
      modelMeta,
      body,
      imageParameters,
      imageReservedKeys
    );
    reservation = await reserveResearchUsage(readWallet(body), {
      imageCount,
      model,
      service: "image",
    });
    const result = await generateImage(
      {
        ...parameters,
        model,
        prompt,
        provider: readProvider(body.provider),
        response_format: "b64_json",
        verify_tee: shouldRequestTeeVerification(body.verify_tee),
      },
      request.signal
    );
    const usage = await settleResearchUsage({
      computeStatus: "used",
      reservation,
      routerTrace: result.trace,
      tokenUsage: result.usage,
      topic: `0G image generation: ${model}`,
    });

    return routerJsonResponse({
      ...asObject(result.data),
      usage,
    }, result.headers);
  } catch (error) {
    if (reservation) {
      await refundResearchUsage(
        reservation,
        error instanceof Error ? error.message : "0G image generation failed."
      ).catch(() => undefined);
    }

    return mixedErrorResponse(error);
  }
}

export async function handleZeroGAsyncImageGeneration(request: Request) {
  let body: JsonBody;

  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const model = readString(body.model) || getDefaultRouterModel("image");
  const prompt = readString(body.prompt);
  const imageCount = readPositiveNumber(body.n) || 1;

  if (!prompt) {
    return Response.json({ error: "prompt is required." }, { status: 400 });
  }

  if (
    body.response_format !== undefined &&
    body.response_format !== "b64_json"
  ) {
    return Response.json(
      { error: "response_format must be b64_json." },
      { status: 400 }
    );
  }

  let reservation: UsageReservation | undefined;

  try {
    const modelMeta = requireRouterModelForService({
      model: await findRouterModel(model),
      modelId: model,
      service: "image",
    });
    const parameters = pickSupportedJsonParameters(
      modelMeta,
      body,
      imageParameters,
      imageReservedKeys
    );
    reservation = await reserveResearchUsage(readWallet(body), {
      imageCount,
      model,
      service: "image",
    });
    const result = await submitAsyncImageGeneration(
      {
        ...parameters,
        model,
        prompt,
        provider: readProvider(body.provider),
        response_format: "b64_json",
        verify_tee: shouldRequestTeeVerification(body.verify_tee),
      },
      request.signal
    );

    return routerJsonResponse({
      ...asObject(result.data),
      billing: {
        reservationId: reservation.reservationId,
        reservedNeuron: reservation.reservedNeuron,
        status: "reserved",
      },
    }, result.headers);
  } catch (error) {
    if (reservation) {
      await refundResearchUsage(
        reservation,
        error instanceof Error ? error.message : "0G async image submit failed."
      ).catch(() => undefined);
    }

    return mixedErrorResponse(error);
  }
}

export async function handleZeroGAsyncJob(request: Request) {
  const url = new URL(request.url);
  const jobId = decodeURIComponent(url.pathname.split("/").pop() || "");
  const reservationId = url.searchParams.get("reservation_id") || "";

  if (!jobId) {
    return Response.json({ error: "jobId is required." }, { status: 400 });
  }

  if (!reservationId) {
    return Response.json(
      { error: "reservation_id is required." },
      { status: 400 }
    );
  }

  let reservation: UsageReservation | undefined;

  try {
    const wallet = readWalletHeaders(request);
    reservation = await readUsageReservation(wallet, reservationId);
    const result = await readAsyncJob({
      jobId,
      model: url.searchParams.get("model") || undefined,
      providerAddress: url.searchParams.get("provider_address") || undefined,
      signal: request.signal,
      verifyTee: shouldRequestTeeVerification(
        url.searchParams.get("verify_tee")
      ),
    });
    const status = readString(asObject(result.data).status);

    if (status === "completed") {
      const usage = await settleResearchUsage({
        computeStatus: "used",
        reservation,
        routerTrace: result.trace || parseNestedTrace(result.data),
        tokenUsage: result.usage,
        topic: `0G async image job: ${jobId}`,
      });

      return routerJsonResponse({
        ...asObject(result.data),
        usage,
      }, result.headers);
    }

    if (status === "failed" || status === "error") {
      const usage = await refundResearchUsage(
        reservation,
        `0G async image job ${jobId} failed.`
      );

      return Response.json({
        ...asObject(result.data),
        usage,
      });
    }

    return routerJsonResponse({
      ...asObject(result.data),
      billing: {
        reservationId,
        reservedNeuron: reservation.reservedNeuron,
        status: "reserved",
      },
    }, result.headers);
  } catch (error) {
    return mixedErrorResponse(error);
  }
}

export async function handleZeroGAudioTranscription(request: Request) {
  let incoming: FormData;

  try {
    incoming = await request.formData();
  } catch {
    return Response.json(
      { error: "Request body must be multipart/form-data." },
      { status: 400 }
    );
  }

  const wallet = readWalletFormData(incoming);
  const model = readString(incoming.get("model")) || getDefaultRouterModel("audio");
  const file = incoming.get("file");

  if (!(file instanceof Blob)) {
    return Response.json({ error: "file is required." }, { status: 400 });
  }

  let reservation: UsageReservation | undefined;

  try {
    const modelMeta = requireRouterModelForService({
      model: await findRouterModel(model),
      modelId: model,
      service: "audio",
    });
    const parameters = pickSupportedFormParameters(
      modelMeta,
      incoming,
      audioParameters,
      audioReservedKeys
    );
    reservation = await reserveResearchUsage(wallet, {
      model,
      service: "audio",
    });
    const formData = new FormData();
    formData.set("file", file);
    formData.set("model", model);

    for (const [key, value] of parameters) {
      formData.set(key, value);
    }

    const result = await transcribeAudio({
      formData,
      signal: request.signal,
      verifyTee: shouldRequestTeeVerification(
        new URL(request.url).searchParams.get("verify_tee") ??
          incoming.get("verify_tee")
      ),
    });
    const usage = await settleResearchUsage({
      computeStatus: "used",
      reservation,
      routerTrace: result.trace,
      tokenUsage: result.usage,
      topic: `0G audio transcription: ${model}`,
    });

    return routerJsonResponse({
      ...asObject(result.data),
      usage,
    }, result.headers);
  } catch (error) {
    if (reservation) {
      await refundResearchUsage(
        reservation,
        error instanceof Error ? error.message : "0G audio transcription failed."
      ).catch(() => undefined);
    }

    return mixedErrorResponse(error);
  }
}

export async function handleZeroGAdminAccountBalance(request: Request) {
  const denied = requireAdmin(request);

  if (denied) {
    return denied;
  }

  try {
    const result = await readRouterAccountBalance();

    return Response.json(result.data);
  } catch (error) {
    return routerErrorResponse(error);
  }
}

export async function handleZeroGAdminUsageStats(request: Request) {
  const denied = requireAdmin(request);

  if (denied) {
    return denied;
  }

  try {
    const result = await readRouterUsageStats(new URL(request.url).searchParams.toString());

    return Response.json(result.data);
  } catch (error) {
    return routerErrorResponse(error);
  }
}

export async function handleZeroGAdminUsageHistory(request: Request) {
  const denied = requireAdmin(request);

  if (denied) {
    return denied;
  }

  try {
    const result = await readRouterUsageHistory(
      new URL(request.url).searchParams.toString()
    );

    return Response.json(result.data);
  } catch (error) {
    return routerErrorResponse(error);
  }
}

async function streamChatResponse(
  payload: Record<string, unknown>,
  reservation: UsageReservation,
  signal: AbortSignal
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let settled = false;
      const write = (value: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      };

      try {
        const result = await streamChatCompletion({
          onDelta: (delta) => write({ type: "delta", delta }),
          payload: payload as Parameters<typeof streamChatCompletion>[0]["payload"],
          signal,
        });
        const usage = await settleResearchUsage({
          computeStatus: "used",
          reservation,
          routerTrace: result.trace,
          tokenUsage: result.usage,
          topic: `0G chat completion: ${reservation.model}`,
        });
        settled = true;

        write({
          type: "result",
          payload: {
            answer: result.answer,
            model: reservation.model,
            trace: result.trace,
            usage,
          },
        });
      } catch (error) {
        if (!settled) {
          await refundResearchUsage(
            reservation,
            error instanceof Error ? error.message : "0G chat stream failed."
          ).catch(() => undefined);
        }

        write({
          type: "error",
          error: error instanceof Error ? error.message : "0G chat stream failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}

function mixedErrorResponse(error: unknown) {
  const response = usageErrorResponse(error);

  if (response.status !== 500) {
    return response;
  }

  return routerErrorResponse(error);
}

function routerJsonResponse(payload: unknown, sourceHeaders?: Headers) {
  const headers = new Headers();

  for (const name of [
    "Retry-After",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ]) {
    const value = sourceHeaders?.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return Response.json(payload, { headers });
}

function requireAdmin(request: Request) {
  const expected = process.env.LANGCLAW_ADMIN_API_KEY?.trim();

  if (!expected) {
    return Response.json(
      { error: "LANGCLAW_ADMIN_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : "";
  const header = request.headers.get("x-langclaw-admin-key") || "";

  if (bearer !== expected && header !== expected) {
    return Response.json({ error: "Admin API key is required." }, { status: 401 });
  }

  return null;
}

async function readJsonBody(request: Request): Promise<JsonBody> {
  const body = (await request.json()) as unknown;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid JSON body.");
  }

  return body as JsonBody;
}

function readWallet(body: JsonBody): WalletAuthInput {
  return body.wallet && typeof body.wallet === "object"
    ? (body.wallet as WalletAuthInput)
    : {};
}

function readWalletHeaders(request: Request): WalletAuthInput {
  return {
    address: request.headers.get("x-langclaw-wallet-address") || undefined,
    message: request.headers.get("x-langclaw-wallet-message") || undefined,
    signature: request.headers.get("x-langclaw-wallet-signature") || undefined,
  };
}

function readWalletFormData(formData: FormData): WalletAuthInput {
  const raw = formData.get("wallet");

  if (typeof raw !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as WalletAuthInput;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readProvider(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function pickSupportedJsonParameters(
  model: RouterModel,
  body: JsonBody,
  fallbackParameters: string[],
  reservedKeys: string[]
) {
  const reserved = new Set(reservedKeys);
  const keys = Object.keys(body).filter(
    (key) => body[key] !== undefined && !reserved.has(key)
  );
  const supported = readSupportedParameters(model, fallbackParameters);

  requireSupportedRouterParameters(
    {
      ...model,
      supported_parameters: [...supported],
    },
    keys
  );

  return keys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = body[key];

    return acc;
  }, {});
}

function pickSupportedFormParameters(
  model: RouterModel,
  formData: FormData,
  fallbackParameters: string[],
  reservedKeys: string[]
) {
  const reserved = new Set(reservedKeys);
  const keys = [...new Set([...formData.keys()])].filter(
    (key) => !reserved.has(key)
  );
  const supported = readSupportedParameters(model, fallbackParameters);

  requireSupportedRouterParameters(
    {
      ...model,
      supported_parameters: [...supported],
    },
    keys
  );

  return keys
    .map((key) => [key, formData.get(key)] as const)
    .filter((item): item is readonly [string, FormDataEntryValue] => item[1] !== null);
}

function readSupportedParameters(
  model: RouterModel,
  fallbackParameters: string[]
) {
  return new Set(
    model.supported_parameters?.length
      ? model.supported_parameters
      : fallbackParameters
  );
}

function readPositiveNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseNestedTrace(value: unknown): RouterTrace | undefined {
  const data = asObject(value);
  const trace = data.x_0g_trace;

  if (!trace || typeof trace !== "object") {
    return undefined;
  }

  const record = trace as {
    billing?: {
      input_cost?: unknown;
      output_cost?: unknown;
      total_cost?: unknown;
    };
    provider?: unknown;
    request_id?: unknown;
    tee_verified?: unknown;
  };

  return {
    billing: record.billing
      ? {
          inputCostNeuron: readString(record.billing.input_cost) || undefined,
          outputCostNeuron: readString(record.billing.output_cost) || undefined,
          totalCostNeuron: readString(record.billing.total_cost) || undefined,
        }
      : undefined,
    provider: readString(record.provider) || undefined,
    requestId: readString(record.request_id) || undefined,
    teeVerified:
      typeof record.tee_verified === "boolean"
        ? record.tee_verified
        : record.tee_verified === null
          ? null
          : undefined,
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
