import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/config";
import { buildEvaluatorMessages } from "@/lib/scoring/prompt";
import { parseScoreResult, ScoringParseError } from "@/lib/scoring/schema";
import type { Scenario } from "@/types/scenario";

interface EvaluateRequestBody {
  scenario?: Scenario;
  userAnswer?: string;
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
  let body: EvaluateRequestBody;
  try {
    body = (await request.json()) as EvaluateRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确，请重试。" }, { status: 400 });
  }

  const scenario = body.scenario;
  const userAnswer = body.userAnswer?.trim();
  const settings = resolveServerSettings();

  if (!scenario?.promptZh) {
    return NextResponse.json({ error: "缺少练习场景，请刷新后重试。" }, { status: 400 });
  }

  if (!userAnswer) {
    return NextResponse.json({ error: "请先输入一句你会说的英文。" }, { status: 400 });
  }

  if (!settings) {
    return NextResponse.json(
      { error: "AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。" },
      { status: 503 }
    );
  }

  try {
    const rawResult = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider: settings.provider,
      messages: buildEvaluatorMessages(scenario, userAnswer),
      temperature: 0.15,
      jsonMode: true
    });
    return NextResponse.json({ result: parseScoreResult(rawResult) });
  } catch (error) {
    if (error instanceof ScoringParseError) {
      return NextResponse.json(
        { error: "AI 返回的内容不是严格 JSON，请再试一次。" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? `评分失败：${error.message}` : "评分失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
