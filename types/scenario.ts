export const TOPIC_OPTIONS = [
  { value: "daily", label: "日常闲聊" },
  { value: "workplace", label: "职场沟通" },
  { value: "help", label: "请求帮忙" },
  { value: "disagreement", label: "表达不同意见" },
  { value: "plans", label: "约时间做计划" },
  { value: "food", label: "点餐吃饭" },
  { value: "apology", label: "道歉解释" },
  { value: "clarifying", label: "确认澄清" },
  { value: "reacting", label: "自然回应" },
  { value: "emotions", label: "情绪表达" }
] as const;

export const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "入门" },
  { value: "intermediate", label: "进阶" },
  { value: "advanced", label: "高阶" }
] as const;

export type Topic = (typeof TOPIC_OPTIONS)[number]["value"];
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]["value"];

export interface Scenario {
  id: string;
  promptZh: string;
  speaker: string;
  listener: string;
  relationship: string;
  mood: string;
  situation: string;
  topic: Topic;
  difficulty: Difficulty;
  intent: string;
  referenceAnswers: string[];
  wordHints?: string[];
  source?: "starter" | "ai";
}
