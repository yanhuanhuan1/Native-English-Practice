import { NextResponse } from "next/server";
import { starterScenarios } from "@/data/scenarios";
import { requestChatCompletion } from "@/lib/ai/client";
import { getProviderPreset } from "@/lib/ai/config";
import { buildScenarioGeneratorMessages } from "@/lib/scoring/prompt";
import { parseGeneratedScenario, ScoringParseError } from "@/lib/scoring/schema";
import type { Difficulty, Topic } from "@/types/scenario";

interface GenerateScenarioRequestBody {
  topic?: Topic | "all";
  difficulty?: Difficulty | "all";
  recentPromptZh?: string[];
}

const beginnerSceneFamilies = [
  "短句感谢",
  "简单请求",
  "问路找地方",
  "点餐买东西",
  "轻微道歉",
  "临时改计划",
  "简单确认",
  "随口反应"
];

const intermediateSceneFamilies = [
  "同事闲聊",
  "委婉拒绝",
  "解释原因",
  "澄清误会",
  "轻微冲突",
  "提醒对方",
  "安慰朋友",
  "临时调整"
];

const advancedSceneFamilies = [
  "带情绪的反驳",
  "边界感表达",
  "快速插话",
  "微妙社交场合",
  "含蓄不爽",
  "更像真人聊天",
  "协商和让步",
  "讽刺或无奈"
];

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

function pickSceneFamily(difficulty?: Difficulty): string {
  const pool =
    difficulty === "beginner"
      ? beginnerSceneFamilies
      : difficulty === "intermediate"
        ? intermediateSceneFamilies
        : difficulty === "advanced"
          ? advancedSceneFamilies
          : [
              ...beginnerSceneFamilies,
              ...intermediateSceneFamilies,
              ...advancedSceneFamilies
            ];

  return pool[Math.floor(Math.random() * pool.length)] ?? "日常聊天";
}

function normalizePrompt(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u3000，。！？、,.!?;；:：'"“”‘’（）()[\]{}<>《》【】\-_]/g, "");
}

function isDuplicatePrompt(promptZh: string, recentPromptZh: string[]): boolean {
  const normalized = normalizePrompt(promptZh);
  return recentPromptZh.some((prompt) => normalizePrompt(prompt) === normalized);
}

function pickStarterScenario(
  difficulty: Difficulty | undefined,
  recentPromptZh: string[]
): (typeof starterScenarios)[number] | null {
  const pool = starterScenarios.filter(
    (scenario) => !difficulty || scenario.difficulty === difficulty
  );
  const available = pool.filter(
    (scenario) => !isDuplicatePrompt(scenario.promptZh, recentPromptZh)
  );
  const candidates = available.length > 0 ? available : pool;

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
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
  const recentPromptZh = Array.isArray(body.recentPromptZh)
    ? body.recentPromptZh
        .filter((prompt): prompt is string => typeof prompt === "string")
        .map((prompt) => prompt.trim())
        .filter((prompt) => prompt.length > 0)
        .slice(0, 8)
    : [];

  if (!settings) {
    return NextResponse.json(
      { error: "AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。" },
      { status: 503 }
    );
  }

  try {
    const sceneFamily = pickSceneFamily(difficulty);
    const rawScenario = await requestChatCompletion({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      provider: settings.provider,
      messages: buildScenarioGeneratorMessages(
        topic,
        difficulty,
        recentPromptZh,
        sceneFamily
      ),
      temperature: difficulty === "beginner" ? 0.95 : 0.82,
      topP: 0.96,
      presencePenalty: difficulty === "beginner" ? 0.85 : 0.55,
      frequencyPenalty: 0.25,
      jsonMode: true
    });
    const scenario = parseGeneratedScenario(rawScenario);

    if (isDuplicatePrompt(scenario.promptZh, recentPromptZh)) {
      const starterScenario = pickStarterScenario(difficulty, recentPromptZh);
      if (starterScenario) {
        return NextResponse.json({
          scenario: { ...starterScenario, source: "starter" as const }
        });
      }
    }

    return NextResponse.json({
      scenario: { id: `ai-${crypto.randomUUID()}`, ...scenario, source: "ai" }
    });
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
          error instanceof Error
            ? `生成失败：${error.message}`
            : "生成失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
