import {
  getDefaultRouterModel,
  hasRouterApiKey,
  isRouterInferenceEnabled,
  resolveRouterModelSelection,
  shouldRequestTeeVerification,
  streamChatCompletion,
  type RouterChatMessage,
} from "./zero-g/router";

export type DirectChatContextMessage = {
  role: "assistant" | "user";
  content: string;
};

type DirectChatInput = {
  message: string;
  context: DirectChatContextMessage[];
  requestedModel?: unknown;
  signal: AbortSignal;
  onDelta?: (delta: string) => void;
};

export async function streamDirectChatWithZeroGCompute({
  context,
  message,
  onDelta,
  requestedModel,
  signal,
}: DirectChatInput) {
  const selection = await resolveRouterModelSelection({
    requestedModel,
    service: "chat",
  }).catch(() => ({
    fallbackFrom: typeof requestedModel === "string" ? requestedModel : undefined,
    modelHonored: false,
    requestedModel: typeof requestedModel === "string" ? requestedModel : undefined,
    usedModel: getDefaultRouterModel("chat"),
  }));
  const model = selection.usedModel;

  if (!isRouterInferenceEnabled() || !hasRouterApiKey()) {
    const answer = buildLocalFallback(message, context);
    onDelta?.(answer);
    return {
      answer,
      fallbackFrom: selection.fallbackFrom,
      model,
      modelHonored: selection.modelHonored,
      requestedModel: selection.requestedModel,
      source: "fallback" as const,
      usedModel: selection.usedModel,
    };
  }

  try {
    const result = await streamChatCompletion({
      onDelta,
      payload: {
        model,
        messages: buildMessages(message, context),
        stream: true,
        temperature: 0.4,
        verify_tee: shouldRequestTeeVerification(),
      },
      signal,
    });

    if (!result.answer.trim()) {
      throw new Error("0G chat returned an empty answer.");
    }

    return {
      answer: result.answer.trim(),
      fallbackFrom: selection.fallbackFrom,
      model,
      modelHonored: selection.modelHonored,
      requestedModel: selection.requestedModel,
      source: "0g-compute" as const,
      teeVerified: result.trace?.teeVerified,
      teeVerification: result.teeVerification,
      usedModel: selection.usedModel,
    };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    const answer = buildLocalFallback(message, context);
    onDelta?.(answer);

    return {
      answer,
      error: error instanceof Error ? error.message : "0G chat failed.",
      fallbackFrom: selection.fallbackFrom,
      model,
      modelHonored: selection.modelHonored,
      requestedModel: selection.requestedModel,
      source: "fallback" as const,
      usedModel: selection.usedModel,
    };
  }
}

function buildMessages(
  message: string,
  context: DirectChatContextMessage[]
): RouterChatMessage[] {
  const sessionContext = context.filter(
    (item, index) =>
      !(
        index === context.length - 1 &&
        item.role === "user" &&
        item.content === message
      )
  );

  return [
    {
      role: "system",
      content:
        "You are Langclaw, a concise and helpful chat assistant. Answer naturally in the user's language. If the message is Indonesian or casual Indonesian spelling such as hay, hai, halo, or makasih, reply in Indonesian. Use the current chat session as context, especially prior research summaries, source cards, recommendations, and agent results. For follow-up questions like menurutmu, bagusnya aku buat apa, lanjut, itu, tadi, or sebelumnya, infer the topic from the previous messages and give a concrete answer. Do not ask for background that already exists in the session. Do not mention direct chat, routing, agent mode, OpenClaw, or internal workflows unless the user asks about them.",
    },
    ...sessionContext.slice(-10).map((item) => ({
      role: item.role,
      content: item.content,
    })),
    {
      role: "user",
      content: message,
    },
  ];
}

function buildLocalFallback(
  message: string,
  context: DirectChatContextMessage[]
) {
  const previousUser = [...context]
    .reverse()
    .find((item) => item.role === "user" && item.content !== message);

  if (/^(hai|halo|hello|hi|hay|hey|pagi|siang|malam)\b/i.test(message)) {
    return "Hai. Ada yang bisa aku bantu?";
  }

  if (/konteks|context|sebelumnya|tadi/i.test(message) && previousUser) {
    return `Konteks terakhir dari sesi ini adalah: "${previousUser.content}".`;
  }

  return "Aku belum bisa menghubungi model chat sekarang. Coba lagi sebentar.";
}
