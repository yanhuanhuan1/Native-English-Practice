import {
  AI_PROVIDER_CONFIG,
  buildProviderRequestUrl,
  type AiProviderPreset,
  type ChatMessage
} from "@/lib/ai/config";

export class AiClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiClientError";
    this.status = status;
  }
}

interface RequestChatCompletionArgs {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: AiProviderPreset;
  messages: ChatMessage[];
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  jsonMode?: boolean;
}

export async function requestChatCompletion(
  args: RequestChatCompletionArgs
): Promise<string> {
  if (args.provider.protocol === "anthropic") {
    return requestAnthropicMessages(args);
  }

  return requestOpenAiCompatibleChat(args);
}

async function requestOpenAiCompatibleChat({
  apiKey,
  baseUrl,
  model,
  provider,
  messages,
  temperature = 0.2,
  topP,
  presencePenalty,
  frequencyPenalty,
  jsonMode = true
}: RequestChatCompletionArgs): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_PROVIDER_CONFIG.requestTimeoutMs
  );

  try {
    const response = await fetch(
      buildProviderRequestUrl(baseUrl, provider.endpointPath, provider.id),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          ...(typeof topP === "number" ? { top_p: topP } : {}),
          ...(typeof presencePenalty === "number"
            ? { presence_penalty: presencePenalty }
            : {}),
          ...(typeof frequencyPenalty === "number"
            ? { frequency_penalty: frequencyPenalty }
            : {}),
          ...(jsonMode && provider.supportsJsonMode
            ? { response_format: { type: "json_object" } }
            : {})
        }),
        signal: controller.signal
      }
    );

    const payload = parseJsonObject(await response.text());

    if (!response.ok) {
      throw new AiClientError(extractErrorMessage(payload), response.status);
    }

    const content = extractOpenAiAssistantContent(payload);

    if (!content) {
      throw new AiClientError("AI 返回内容为空，请稍后重试。");
    }

    return content;
  } catch (error) {
    throw normalizeAiError(error);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAnthropicMessages({
  apiKey,
  baseUrl,
  model,
  provider,
  messages,
  temperature = 0.2
}: RequestChatCompletionArgs): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_PROVIDER_CONFIG.requestTimeoutMs
  );

  try {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const userMessages = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    const response = await fetch(
      buildProviderRequestUrl(baseUrl, provider.endpointPath, provider.id),
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature,
          ...(system ? { system } : {}),
          messages: userMessages
        }),
        signal: controller.signal
      }
    );

    const payload = parseJsonObject(await response.text());

    if (!response.ok) {
      throw new AiClientError(extractErrorMessage(payload), response.status);
    }

    const content = extractAnthropicTextContent(payload);

    if (!content) {
      throw new AiClientError("AI 返回内容为空，请稍后重试。");
    }

    return content;
  } catch (error) {
    throw normalizeAiError(error);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAiError(error: unknown): AiClientError {
  if (error instanceof AiClientError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AiClientError("AI 请求超时，请稍后重试。");
  }

  return new AiClientError(
    error instanceof Error ? error.message : "AI 请求失败，请稍后重试。"
  );
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiClientError("AI 服务返回了非 JSON 内容，请检查接口地址。");
  }
}

function extractOpenAiAssistantContent(payload: unknown): string | null {
  const root = asRecord(payload);
  const choices = root?.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);
  const content = message?.content;

  return typeof content === "string" ? content : null;
}

function extractAnthropicTextContent(payload: unknown): string | null {
  const root = asRecord(payload);
  const content = root?.content;

  if (!Array.isArray(content)) {
    return null;
  }

  const textBlocks = content
    .map((block) => asRecord(block))
    .filter((block) => block?.type === "text")
    .map((block) => block?.text)
    .filter((text): text is string => typeof text === "string");

  return textBlocks.join("").trim() || null;
}

function extractErrorMessage(payload: unknown): string {
  const root = asRecord(payload);
  const error = asRecord(root?.error);
  const message = error?.message;

  return typeof message === "string"
    ? message
    : "AI 服务拒绝了本次请求。";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
