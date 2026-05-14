export type DirectChatContextMessage = {
  role: "assistant" | "user";
  content: string;
};

type DirectChatInput = {
  message: string;
  context: DirectChatContextMessage[];
  signal: AbortSignal;
  onDelta?: (delta: string) => void;
};

type ChatCompletionPayload = {
  choices?: Array<{
    delta?: {
      content?: unknown;
    };
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: unknown;
  };
};

const defaultRouterUrl = "https://router-api-testnet.integratenetwork.work/v1";
const defaultModel = "qwen/qwen-2.5-7b-instruct";

export async function streamDirectChatWithZeroGCompute({
  context,
  message,
  onDelta,
  signal,
}: DirectChatInput) {
  const endpoint = normalizeRouterUrl(
    process.env.OG_COMPUTE_ROUTER_URL || defaultRouterUrl
  );
  const model =
    process.env.OG_DIRECT_CHAT_MODEL?.trim() ||
    process.env.OG_COMPUTE_MODEL?.trim() ||
    defaultModel;
  const apiKey = process.env.OG_COMPUTE_API_KEY?.trim();

  if (process.env.OG_COMPUTE_ENABLED !== "true" || !apiKey) {
    const answer = buildLocalFallback(message, context);
    onDelta?.(answer);
    return { answer, model, source: "fallback" as const };
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(
    abort,
    readPositiveInt(process.env.OG_COMPUTE_TIMEOUT_SECONDS, 90) * 1000
  );

  signal.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(message, context),
        stream: true,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`0G chat returned HTTP ${response.status}.`);
    }

    if (!response.body) {
      throw new Error("0G chat returned an empty response body.");
    }

    const answer = await readStreamingAnswer(response.body, onDelta);

    if (!answer.trim()) {
      throw new Error("0G chat returned an empty answer.");
    }

    return { answer: answer.trim(), model, source: "0g-compute" as const };
  } catch (error) {
    if (signal.aborted || controller.signal.aborted) {
      throw error;
    }

    const answer = buildLocalFallback(message, context);
    onDelta?.(answer);

    return {
      answer,
      error: error instanceof Error ? error.message : "0G chat failed.",
      model,
      source: "fallback" as const,
    };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

function buildMessages(message: string, context: DirectChatContextMessage[]) {
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

async function readStreamingAnswer(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const delta = readStreamLine(line);

      if (!delta) {
        continue;
      }

      answer += delta;
      onDelta?.(delta);
    }
  }

  const delta = readStreamLine(buffer);

  if (delta) {
    answer += delta;
    onDelta?.(delta);
  }

  return answer;
}

function readStreamLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return "";
  }

  const data = trimmed.startsWith("data:")
    ? trimmed.slice("data:".length).trim()
    : trimmed;

  if (!data || data === "[DONE]") {
    return "";
  }

  try {
    const payload = JSON.parse(data) as ChatCompletionPayload;

    return (
      readString(payload.choices?.[0]?.delta?.content) ||
      readString(payload.choices?.[0]?.message?.content) ||
      ""
    );
  } catch {
    return "";
  }
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

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeRouterUrl(value: string) {
  return value.replace(/\/+$/, "");
}
