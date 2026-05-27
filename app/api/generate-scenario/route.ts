import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { coerceApiSettings, getProviderPreset } from "@/lib/ai/config";
import { buildScenarioGeneratorMessages } from "@/lib/scoring/prompt";
import { parseGeneratedScenario, ScoringParseError } from "@/lib/scoring/schema";
import type { Difficulty, Topic } from "@/types/scenario";
import type { ApiSettings } from "@/types/settings";

interface GenerateScenarioRequestBody {
  topic?: Topic | "all";
  difficulty?: Difficulty | "all";
  settings?: Partial<ApiSettings>;
}

function resolveSettings(clientSettings?: Partial<ApiSettings>): ApiSettings {
  const serverKey = process.env.API_KEY?.trim();
  if (serverKey) {
    const providerId = process.env.API_PROVIDER_ID?.trim() ?? "deepseek";
    const preset = getProviderPreset(providerId);
    return {
      apiKey: serverKey,
      providerId: preset.id,
      baseUrl: process.env.API_BASE_URL?.trim() || preset.baseUrl,
      model: process.env.API_MODEL?.trim() || preset.model
    };
  }
  return coerceApiSettings(clientSettings);
}

export async function POST(request: Request) {
  let body: GenerateScenarioRequestBody;
  try {
    body = (await request.json()) as GenerateScenarioRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确，请重试。" }, { status: 400 });
  }

  const settings = resolveSettings(body.settings);
  const provider = getProviderPreset(settings.providerId);
  const topic = body.topic === "all" ? undefined : body.topic;
  const difficulty = body.difficulty === "all" ? undefined : body.difficulty;

  if (!settings.apiKey) {
    return NextResponse.json({ error: `请先在设置里填写 ${provider.apiKeyLabel}。` }, { status: 401 });
  }

  try {
    const rawScenario = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider,
      messages: buildScenarioGeneratorMessages(topic, difficulty),
      temperature: 0.8,
      jsonMode: true
    });
    const scenario = parseGeneratedScenario(rawScenario);
    return NextResponse.json({ scenario: { id: `ai-${crypto.randomUUID()}`, ...scenario, source: "ai" } });
  } catch (error) {
    if (error instanceof ScoringParseError) {
      return NextResponse.json({ error: "AI 生成的场景格式不正确，请再试一次。" }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? `生成失败：${error.message}` : "生成失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
