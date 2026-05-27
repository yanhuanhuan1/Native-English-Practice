import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { coerceApiSettings, getProviderPreset } from "@/lib/ai/config";
import { buildEvaluatorMessages } from "@/lib/scoring/prompt";
import { parseScoreResult, ScoringParseError } from "@/lib/scoring/schema";
import type { Scenario } from "@/types/scenario";
import type { ApiSettings } from "@/types/settings";

interface EvaluateRequestBody {
  scenario?: Scenario;
  userAnswer?: string;
  settings?: Partial<ApiSettings>;
}

function resolveSettings(clientSettings?: Partial<ApiSettings>): ApiSettings & { apiKey: string } {
  const serverKey = process.env.API_KEY?.trim();
  if (serverKey) {
    return coerceApiSettings({
      apiKey: serverKey,
      providerId: process.env.API_PROVIDER_ID ?? clientSettings?.providerId,
      model: process.env.API_MODEL ?? clientSettings?.model,
      baseUrl: process.env.API_BASE_URL ?? clientSettings?.baseUrl
    });
  }
  return coerceApiSettings(clientSettings);
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
  const settings = resolveSettings(body.settings);
  const provider = getProviderPreset(settings.providerId);

  if (!scenario?.promptZh) {
    return NextResponse.json({ error: "缺少练习场景，请刷新后重试。" }, { status: 400 });
  }
  if (!userAnswer) {
    return NextResponse.json({ error: "请先输入一句你会说的英文。" }, { status: 400 });
  }
  if (!settings.apiKey) {
    return NextResponse.json({ error: `请先在设置里填写 ${provider.apiKeyLabel}。` }, { status: 401 });
  }

  try {
    const rawResult = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider,
      messages: buildEvaluatorMessages(scenario, userAnswer),
      temperature: 0.15,
      jsonMode: true
    });
    return NextResponse.json({ result: parseScoreResult(rawResult) });
  } catch (error) {
    if (error instanceof ScoringParseError) {
      return NextResponse.json({ error: "AI 返回的内容不是严格 JSON，请再试一次。" }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? `评分失败：${error.message}` : "评分失败，请稍后重试。" },
      { status: 502 }
    );
  }
}
