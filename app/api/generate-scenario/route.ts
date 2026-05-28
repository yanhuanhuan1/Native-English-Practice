import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/config";
import { buildScenarioGeneratorMessages } from "@/lib/scoring/prompt";
import { parseGeneratedScenario, ScoringParseError } from "@/lib/scoring/schema";
import type { Difficulty, Topic } from "@/types/scenario";

interface GenerateScenarioRequestBody {
  topic?: Topic | "all";
  difficulty?: Difficulty | "all";
}

function resolveServerSettings() {
  const apiKey = process.env.API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const providerId = process.env.API_PROVIDER_ID?.trim() ?? "deepseek";
  const preset = getProviderPreset(providerId);

  return {
    apiKey,
    provider: preset,
    baseUrl: process.env.API_BASE_URL?.trim() || preset.baseUrl,
    model: process.env.API_MODEL?.trim() || preset.model
  };
}

export async function POST(request: Request) {
  let body: GenerateScenarioRequestBody;
  try {
    body = (await request.json()) as GenerateScenarioRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确，请重试。" }, { status: 400 });
  }

  const settings = resolveServerSettings();
  const topic = body.topic === "all" ? undefined : body.topic;
  const difficulty = body.difficulty === "all" ? undefined : body.difficulty;

  if (!settings) {
    return NextResponse.json(
      { error: "AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。" },
      { status: 503 }
    );
  }

  try {
    const rawScenario = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider: settings.provider,
      messages: buildScenarioGeneratorMessages(topic, difficulty),
      temperature: 0.8,
      jsonMode: true
    });
    const scenario = parseGeneratedScenario(rawScenario);
    return NextResponse.json({ scenario: { id: `ai-${crypto.randomUUID()}`, ...scenario, source: "ai" } });
  } catch (error) {
    if (error instanceof ScoringParseError) {
      return NextResponse.json(
        { error: "AI 生成的场景格式不正确，请再试一次。" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? `生成失败：${error.message}` : "生成失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
