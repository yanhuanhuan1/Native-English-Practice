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
  defaultProviderId: "qwen",
  requestTimeoutMs: 45_000
} as const;

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "qwen",
    label: "千问 / 阿里云百炼",
    shortLabel: "千问",
    protocol: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    endpointPath: "/chat/completions",
    model: "qwen-plus",
    supportsJsonMode: true,
    apiKeyLabel: "百炼 API Key",
    note: "默认预设，使用阿里云百炼北京地域的 OpenAI 兼容接口。"
  },
  {
    id: "zhipu",
    label: "智谱 AI / GLM",
    shortLabel: "智谱",
    protocol: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    endpointPath: "/chat/completions",
    model: "glm-5.1",
    supportsJsonMode: true,
    apiKeyLabel: "智谱 API Key",
    note: "适合使用 GLM 系列模型。"
  },
  {
    id: "gemini",
    label: "Gemini / Google AI",
    shortLabel: "Gemini",
    protocol: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    endpointPath: "/chat/completions",
    model: "gemini-2.5-flash",
    supportsJsonMode: false,
    apiKeyLabel: "Gemini API Key",
    note: "使用 Google Gemini 的 OpenAI 兼容层；严格 JSON 主要依赖提示词约束。"
  },
  {
    id: "claude",
    label: "Claude / Anthropic",
    shortLabel: "Claude",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    endpointPath: "/messages",
    model: "claude-sonnet-4-20250514",
    supportsJsonMode: false,
    apiKeyLabel: "Anthropic API Key",
    note: "Claude 使用 Anthropic Messages API，不走 OpenAI Chat Completions。"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    shortLabel: "DeepSeek",
    protocol: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    endpointPath: "/chat/completions",
    model: "deepseek-v4-flash",
    supportsJsonMode: true,
    apiKeyLabel: "DeepSeek API Key",
    note: "使用 DeepSeek 官方 OpenAI 兼容接口。"
  },
  {
    id: "openai",
    label: "OpenAI",
    shortLabel: "OpenAI",
    protocol: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    endpointPath: "/chat/completions",
    model: "gpt-5-mini",
    supportsJsonMode: true,
    apiKeyLabel: "OpenAI API Key",
    note: "适合直接使用 OpenAI 官方 API。"
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    protocol: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    endpointPath: "/chat/completions",
    model: "qwen/qwen3-235b-a22b-2507",
    supportsJsonMode: true,
    apiKeyLabel: "OpenRouter API Key",
    note: "第三方聚合平台，一个 API Key 可路由到多家模型。"
  },
  {
    id: "siliconflow",
    label: "硅基流动 SiliconFlow",
    shortLabel: "硅基流动",
    protocol: "openai-compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
    endpointPath: "/chat/completions",
    model: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    supportsJsonMode: true,
    apiKeyLabel: "硅基流动 API Key",
    note: "国内常用第三方平台，兼容 OpenAI Chat Completions。"
  },
  {
    id: "volcengine",
    label: "火山方舟",
    shortLabel: "火山方舟",
    protocol: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    endpointPath: "/chat/completions",
    model: "doubao-seed-1-6-250615",
    supportsJsonMode: true,
    apiKeyLabel: "火山方舟 API Key",
    note: "如果你在方舟控制台使用自定义接入点，可把模型名改成自己的 endpoint ID。"
  },
  {
    id: "modelscope",
    label: "魔搭 ModelScope",
    shortLabel: "魔搭",
    protocol: "openai-compatible",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    endpointPath: "/chat/completions",
    model: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    supportsJsonMode: true,
    apiKeyLabel: "ModelScope Token",
    note: "魔搭推理 API，适合接入通义、DeepSeek 等开源模型。"
  },
  {
    id: "together",
    label: "Together AI",
    shortLabel: "Together",
    protocol: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    endpointPath: "/chat/completions",
    model: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    supportsJsonMode: true,
    apiKeyLabel: "Together API Key",
    note: "海外第三方模型平台，兼容 OpenAI Chat Completions。"
  },
  {
    id: "groq",
    label: "Groq",
    shortLabel: "Groq",
    protocol: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    endpointPath: "/chat/completions",
    model: "openai/gpt-oss-120b",
    supportsJsonMode: true,
    apiKeyLabel: "Groq API Key",
    note: "海外高速推理平台，适合低延迟反馈。"
  },
  {
    id: "custom-openai",
    label: "自定义 OpenAI 兼容",
    shortLabel: "自定义",
    protocol: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    endpointPath: "/chat/completions",
    model: "gpt-5-mini",
    supportsJsonMode: true,
    apiKeyLabel: "API Key",
    note: "用于 OpenRouter、硅基流动、火山方舟、私有代理或本地兼容服务。"
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
  if (!baseUrl) {
    return null;
  }

  let hostname = "";

  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hostname.includes("dashscope.aliyuncs.com")) return "qwen";
  if (hostname.includes("open.bigmodel.cn")) return "zhipu";
  if (hostname.includes("generativelanguage.googleapis.com")) return "gemini";
  if (hostname.includes("anthropic.com")) return "claude";
  if (hostname.includes("deepseek.com")) return "deepseek";
  if (hostname.includes("api.openai.com")) return "openai";
  if (hostname.includes("openrouter.ai")) return "openrouter";
  if (hostname.includes("siliconflow")) return "siliconflow";
  if (hostname.includes("volces.com")) return "volcengine";
  if (hostname.includes("modelscope.cn")) return "modelscope";
  if (hostname.includes("together.xyz")) return "together";
  if (hostname.includes("groq.com")) return "groq";

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
