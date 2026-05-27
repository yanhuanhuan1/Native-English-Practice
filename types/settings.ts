export type AiProviderProtocol = "openai-compatible" | "anthropic";

export interface ApiSettings {
  apiKey: string;
  providerId: string;
  baseUrl: string;
  model: string;
}
