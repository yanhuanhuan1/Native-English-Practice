import type { ListeningPlayerType, TrainingLevel } from "@/types/daily-training";

export type ExactTrainingLevel =
  | "IELTS 5.0"
  | "IELTS 5.5"
  | "IELTS 6.0"
  | "IELTS 6.5"
  | "IELTS 7.0+";

export interface DailyTrainingVideoReserve {
  id: string;
  level: ExactTrainingLevel;
  topic: string;
  title: string;
  source: "Bilibili";
  url: string;
  embedUrl?: string;
  playerType: ListeningPlayerType;
  duration: string;
  difficulty: string;
  focus: string;
  keywords: string[];
  whySuitable: string;
}

export const trainingLibraryLevels: ExactTrainingLevel[] = [
  "IELTS 5.0",
  "IELTS 5.5",
  "IELTS 6.0",
  "IELTS 6.5",
  "IELTS 7.0+"
];

const levelConfigs: Array<{
  level: ExactTrainingLevel;
  difficulty: string;
  duration: string;
  focusPrefix: string;
  topics: string[];
  series: string[];
}> = [
  {
    level: "IELTS 5.0",
    difficulty: "B1 / IELTS 5.0",
    duration: "3-6 min",
    focusPrefix: "清晰慢速输入",
    topics: [
      "workplace self-introduction",
      "daily small talk",
      "asking for help at work",
      "ordering food and coffee",
      "making simple plans",
      "apologizing casually",
      "clarifying a simple point",
      "talking about routines",
      "reacting to good news",
      "basic customer service"
    ],
    series: [
      "BBC Learning English English at Work",
      "VOA Learning English everyday English",
      "British Council LearnEnglish speaking A2 B1",
      "TED-Ed short English lesson",
      "Bilibili 英语听力 职场口语 英文字幕"
    ]
  },
  {
    level: "IELTS 5.5",
    difficulty: "B1+ / IELTS 5.5",
    duration: "4-8 min",
    focusPrefix: "自然语速适应",
    topics: [
      "joining a new team",
      "discussing weekend plans",
      "making polite requests",
      "handling a small mistake",
      "explaining a simple problem",
      "giving quick opinions",
      "booking travel",
      "workplace phone calls",
      "talking about preferences",
      "short meeting updates"
    ],
    series: [
      "BBC Learning English workplace English",
      "VOA Learning English conversation",
      "British Council LearnEnglish listening B1",
      "TED-Ed everyday English subtitles",
      "Bilibili 商务英语 听力 英文字幕"
    ]
  },
  {
    level: "IELTS 6.0",
    difficulty: "B2- / IELTS 6.0",
    duration: "5-10 min",
    focusPrefix: "职场与生活观点表达",
    topics: [
      "giving feedback at work",
      "negotiating schedules",
      "explaining priorities",
      "solving a customer issue",
      "talking about productivity",
      "disagreeing politely",
      "summarizing a short talk",
      "workplace culture",
      "travel problems",
      "money and budgeting"
    ],
    series: [
      "BBC Learning English 6 Minute English",
      "VOA Learning English As It Is",
      "British Council LearnEnglish B2 listening",
      "TED-Ed business English subtitles",
      "Bilibili 英语精听 B2 英文字幕"
    ]
  },
  {
    level: "IELTS 6.5",
    difficulty: "B2 / IELTS 6.5",
    duration: "6-12 min",
    focusPrefix: "复杂信息抓取",
    topics: [
      "business decision making",
      "remote work discussion",
      "handling disagreement",
      "explaining trade-offs",
      "team communication",
      "career development",
      "consumer behavior",
      "technology at work",
      "work-life balance",
      "short news discussion"
    ],
    series: [
      "BBC Learning English business English",
      "VOA Learning English news words",
      "British Council workplace communication",
      "TED-Ed business communication",
      "Bilibili 雅思听力 6.5 英文字幕"
    ]
  },
  {
    level: "IELTS 7.0+",
    difficulty: "B2+ / IELTS 7.0+",
    duration: "8-15 min",
    focusPrefix: "高阶观点与地道表达",
    topics: [
      "leadership communication",
      "presenting an argument",
      "innovation and society",
      "global business trends",
      "education and technology",
      "health and lifestyle debate",
      "media and misinformation",
      "climate and business",
      "complex problem solving",
      "culture and identity"
    ],
    series: [
      "TED talk English subtitles business",
      "BBC Learning English advanced listening",
      "VOA Learning English technology report",
      "British Council advanced workplace English",
      "Bilibili 雅思口语 7分 英文字幕"
    ]
  }
];

export const dailyTrainingVideoLibrary: DailyTrainingVideoReserve[] = levelConfigs.flatMap(
  (config) =>
    config.topics.flatMap((topic, topicIndex) =>
      config.series.map((series, seriesIndex) => {
        const index = topicIndex * config.series.length + seriesIndex + 1;
        const keywords = [series, topic, "英文字幕", "英语听力"].filter(Boolean);

        return {
          id: `${levelToId(config.level)}-${String(index).padStart(2, "0")}`,
          level: config.level,
          topic: toTitle(topic),
          title: `${toTitle(topic)} - ${series}`,
          source: "Bilibili",
          url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keywords.join(" "))}`,
          playerType: "web",
          duration: config.duration,
          difficulty: config.difficulty,
          focus: `${config.focusPrefix}：${toTitle(topic)}`,
          keywords,
          whySuitable: "作为本等级固定储备主题，用于优先寻找 Bilibili 上可播放、带英文字幕、适合精听的真实视频。"
        } satisfies DailyTrainingVideoReserve;
      })
    )
);

export function getReserveItemsForLevel(level: TrainingLevel): DailyTrainingVideoReserve[] {
  const exactLevel = normalizeLibraryLevel(level);

  return dailyTrainingVideoLibrary.filter((item) => item.level === exactLevel);
}

export function getLibraryLevelCount(level: TrainingLevel): number {
  return getReserveItemsForLevel(level).length;
}

export function pickDailyTrainingReserve(
  level: TrainingLevel,
  usedIds: string[] = [],
  seed: string | number = Date.now()
): DailyTrainingVideoReserve {
  const pool = getReserveItemsForLevel(level);
  const unused = pool.filter((item) => !usedIds.includes(item.id));
  const candidates = unused.length ? unused : pool;
  const index = Math.abs(hashSeed(`${seed}-${level}-${usedIds.join("|")}`)) % candidates.length;

  return candidates[index] ?? dailyTrainingVideoLibrary[0];
}

export function normalizeLibraryLevel(level: TrainingLevel): ExactTrainingLevel {
  if (trainingLibraryLevels.includes(level as ExactTrainingLevel)) {
    return level as ExactTrainingLevel;
  }

  if (level === "IELTS 6.0-6.5") {
    return "IELTS 6.5";
  }

  if (level === "IELTS 7+") {
    return "IELTS 7.0+";
  }

  return "IELTS 5.0";
}

function levelToId(level: ExactTrainingLevel): string {
  return level.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toTitle(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function hashSeed(value: string): number {
  return value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
}
