export interface AiProviderPreset {
  id: string;
  label: string;
  shortLabel: string;
  protocol: "openai-compatible" | "anthropic";
  baseUrl: string;
  endpointPath: string;
  model: string;
  supportsJsonMode: boolean;
  apiKeyLabel: string;
  note: string;
}

export const AI_PROVIDER_CONFIG = {
  defaultProviderId: "deepseek",
  requestTimeoutMs: 45_000
} as const;

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    shortLabel: "DeepSeek",
    protocol: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    endpointPath: "/chat/completions",
    model: "deepseek-chat",
    supportsJsonMode: true,
    apiKeyLabel: "DeepSeek API Key",
    note: "使用 DeepSeek 官方 OpenAI 兼容接口。"
  }
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function getProviderPreset(providerId?: string): AiProviderPreset {
  return (
    AI_PROVIDER_PRESETS.find((provider) => provider.id === providerId) ??
    AI_PROVIDER_PRESETS[0]
  );
}

export function normalizeBaseUrl(baseUrl: string, providerId?: string): string {
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    return getProviderPreset(providerId).baseUrl;
  }

  return trimmed.replace(/\/+$/, "");
}

export function buildProviderRequestUrl(
  baseUrl: string,
  endpointPath: string,
  providerId?: string
): string {
  const normalizedBase = normalizeBaseUrl(baseUrl, providerId);
  const normalizedPath = endpointPath.startsWith("/")
    ? endpointPath
    : `/${endpointPath}`;

  if (hasKnownEndpointPath(normalizedBase, normalizedPath)) {
    return normalizedBase;
  }

  return `${normalizedBase}${normalizedPath}`;
}

function hasKnownEndpointPath(url: string, endpointPath: string): boolean {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "");
    const normalizedEndpoint = endpointPath.replace(/\/+$/, "");

    return (
      pathname.endsWith(normalizedEndpoint) ||
      pathname.endsWith("/chat/completions") ||
      pathname.endsWith("/messages")
    );
  } catch {
    return url.endsWith(endpointPath);
  }
}
