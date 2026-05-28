import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/config";
import { buildInsightMessages } from "@/lib/scoring/prompt";
import type { Attempt, InsightReport } from "@/types/scoring";

interface AnalyzeRequestBody {
  attempts: Attempt[];
  previousReports: InsightReport[];
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
  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const settings = resolveServerSettings();

  if (!settings) {
    return NextResponse.json(
      { error: "AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。" },
      { status: 503 }
    );
  }

  if (!body.attempts?.length) {
    return NextResponse.json({ error: "没有可分析的练习记录。" }, { status: 400 });
  }

  try {
    const raw = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider: settings.provider,
      messages: buildInsightMessages(body.attempts, body.previousReports ?? []),
      temperature: 0.3,
      jsonMode: true
    });

    const data = JSON.parse(raw) as {
      weaknesses: string[];
      vocabularyIssues: string[];
      analysis: string;
      improvement?: string;
    };

    const report: InsightReport = {
      generatedAt: new Date().toISOString(),
      attemptCount: body.attempts.length,
      weaknesses: data.weaknesses ?? [],
      vocabularyIssues: data.vocabularyIssues ?? [],
      analysis: data.analysis ?? "",
      improvement: data.improvement
    };

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? `分析失败：${error.message}` : "分析失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
