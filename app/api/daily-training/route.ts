import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/config";
import { buildDailyTrainingMessages } from "@/lib/daily-training/prompt";
import {
  DailyTrainingParseError,
  parseEnglishTrainingDay
} from "@/lib/daily-training/schema";
import type { DailyTrainingHistorySummary } from "@/types/daily-training";

interface DailyTrainingRequestBody {
  date?: string;
  dayNumber?: number;
  historySummary?: DailyTrainingHistorySummary;
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
  let body: DailyTrainingRequestBody;

  try {
    body = (await request.json()) as DailyTrainingRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确，请重试。" }, { status: 400 });
  }

  const date = normalizeDate(body.date);
  const dayNumber =
    typeof body.dayNumber === "number" && Number.isInteger(body.dayNumber) && body.dayNumber > 0
      ? body.dayNumber
      : 1;
  const historySummary = normalizeHistorySummary(body.historySummary);
  const settings = resolveServerSettings();

  if (!settings) {
    return NextResponse.json(
      { error: "AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。" },
      { status: 503 }
    );
  }

  try {
    const rawTraining = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider: settings.provider,
      messages: buildDailyTrainingMessages({ date, dayNumber, historySummary }),
      temperature: 0.35,
      topP: 0.9,
      presencePenalty: 0.2,
      frequencyPenalty: 0.15,
      jsonMode: true
    });

    const training = parseEnglishTrainingDay(rawTraining);

    return NextResponse.json({
      training: {
        ...training,
        date,
        dayNumber,
        completed: false
      }
    });
  } catch (error) {
    if (error instanceof DailyTrainingParseError) {
      return NextResponse.json(
        { error: "AI 返回的每日训练格式不正确，请重新生成一次。" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `生成每日训练失败：${error.message}`
            : "生成每日训练失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}

function normalizeDate(value?: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date().toISOString().slice(0, 10);
}

function normalizeHistorySummary(
  value?: DailyTrainingHistorySummary
): DailyTrainingHistorySummary {
  return {
    totalDays: safeCount(value?.totalDays),
    completedDays: safeCount(value?.completedDays),
    learnedExpressions: safeCount(value?.learnedExpressions),
    reviewAccuracy: safeScore(value?.reviewAccuracy),
    recentTopics: safeStringArray(value?.recentTopics, 8),
    recentWeaknesses: safeStringArray(value?.recentWeaknesses, 12),
    dueReviewExpressions: safeStringArray(value?.dueReviewExpressions, 12),
    recentFeedback: safeStringArray(value?.recentFeedback, 8)
  };
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function safeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function safeStringArray(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString).slice(0, limit) : [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
