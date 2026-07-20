import { NextResponse } from "next/server";
import { requestChatCompletion } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/config";
import { buildSpeakingFeedbackMessages } from "@/lib/daily-training/prompt";
import {
  DailyTrainingParseError,
  parseSpeakingFeedback
} from "@/lib/daily-training/schema";

interface SpeakingFeedbackRequestBody {
  answer?: string;
  expressions?: string[];
  question?: string;
  topic?: string;
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
  let body: SpeakingFeedbackRequestBody;

  try {
    body = (await request.json()) as SpeakingFeedbackRequestBody;
  } catch {
    return NextResponse.json({ error: "请求格式不正确，请重试。" }, { status: 400 });
  }

  const answer = body.answer?.trim();
  const question = body.question?.trim();
  const topic = body.topic?.trim() || "Daily English Training";
  const expressions = Array.isArray(body.expressions)
    ? body.expressions.filter((item) => typeof item === "string" && item.trim()).slice(0, 8)
    : [];

  if (!answer || !question) {
    return NextResponse.json(
      { error: "请先输入你的口语回答，再提交 AI 分析。" },
      { status: 400 }
    );
  }

  const settings = resolveServerSettings();

  if (!settings) {
    return NextResponse.json(
      { error: "AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。" },
      { status: 503 }
    );
  }

  try {
    const rawFeedback = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider: settings.provider,
      messages: buildSpeakingFeedbackMessages({ answer, expressions, question, topic }),
      temperature: 0.25,
      topP: 0.85,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
      jsonMode: true
    });
    const feedback = parseSpeakingFeedback(rawFeedback);

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof DailyTrainingParseError) {
      return NextResponse.json(
        { error: "AI 返回的口语反馈格式不正确，请重新提交一次。" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `口语反馈生成失败：${error.message}`
            : "口语反馈生成失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
