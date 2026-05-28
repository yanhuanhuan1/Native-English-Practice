import type { AiProviderProtocol, ApiSettings } from "@/types/settings";

export interface AiProviderPreset {
  id: string;
  label: string;
  shortLabel: string;
  protocol: AiProviderProtocol;
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

export const DEFAULT_PROVIDER = getProviderPreset(
  AI_PROVIDER_CONFIG.defaultProviderId
);

export const DEFAULT_API_SETTINGS: ApiSettings = {
  apiKey: "",
  providerId: DEFAULT_PROVIDER.id,
  baseUrl: DEFAULT_PROVIDER.baseUrl,
  model: DEFAULT_PROVIDER.model
};

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

export function inferProviderIdFromBaseUrl(baseUrl?: string): string | null {
  if (!baseUrl) return null;
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname.includes("deepseek.com")) return "deepseek";
  } catch {
    return null;
  }
  return null;
}

export function resolveProviderForSettings(
  settings?: Partial<ApiSettings>
): AiProviderPreset {
  if (
    settings?.providerId &&
    settings.providerId !== "custom-openai" &&
    AI_PROVIDER_PRESETS.some((provider) => provider.id === settings.providerId)
  ) {
    return getProviderPreset(settings.providerId);
  }

  return getProviderPreset(
    inferProviderIdFromBaseUrl(settings?.baseUrl) ?? settings?.providerId
  );
}

export function createSettingsForProvider(
  providerId: string,
  apiKey = ""
): ApiSettings {
  const provider = getProviderPreset(providerId);

  return {
    apiKey,
    providerId: provider.id,
    baseUrl: provider.baseUrl,
    model: provider.model
  };
}

export function coerceApiSettings(settings?: Partial<ApiSettings>): ApiSettings {
  const provider = resolveProviderForSettings(settings);

  return {
    apiKey: typeof settings?.apiKey === "string" ? settings.apiKey : "",
    providerId: provider.id,
    baseUrl:
      typeof settings?.baseUrl === "string" && settings.baseUrl.trim()
        ? settings.baseUrl
        : provider.baseUrl,
    model:
      typeof settings?.model === "string" && settings.model.trim()
        ? settings.model
        : provider.model
  };
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
