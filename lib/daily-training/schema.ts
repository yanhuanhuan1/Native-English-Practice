import type {
  DailyTraining,
  ExpressionMastery,
  FillBlankPractice,
  ListeningPlayerType,
  ListeningResource,
  PracticeModule,
  ProgressDashboard,
  ReadingCard,
  ReadingHighlight,
  ReplacementPractice,
  ReviewItem,
  SentenceBuilderPractice,
  SpeakingFeedback,
  TrainingExpression,
  TrainingLevel,
  TrainingPhase,
  TrainingStep,
  WeaknessTracking
} from "@/types/daily-training";

export class DailyTrainingParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyTrainingParseError";
  }
}

const validLevels: TrainingLevel[] = [
  "IELTS 5.0-6.0",
  "IELTS 6.0-6.5",
  "IELTS 7+"
];
const validPhases: TrainingPhase[] = [
  "phase1-foundation",
  "phase2-bridge",
  "phase3-ielts7"
];
const validSteps: TrainingStep[] = [
  "listening",
  "expression",
  "practice",
  "speaking",
  "review"
];
const validPlayerTypes: ListeningPlayerType[] = ["bilibili", "youtube", "audio", "web"];
const validMastery: ExpressionMastery[] = ["new", "learning", "mastered"];

export function parseEnglishTrainingDay(rawContent: string): DailyTraining {
  const data = parseStrictJsonObject(rawContent);
  const dayNumber = positiveInteger(data.dayNumber) ?? 1;
  const level = enumValue(data.level, validLevels) ?? "IELTS 5.0-6.0";
  const phase = enumValue(data.phase, validPhases) ?? inferPhase(dayNumber);
  const expressions = normalizeExpressions(data);

  return {
    date: dateString(data.date) ?? getTodayKey(),
    dayNumber,
    level,
    phase,
    topic: stringValue(data.topic) ?? "Workplace Communication",
    activeStep: enumValue(data.activeStep, validSteps) ?? "listening",
    stepStatus: parseStepStatus(recordValue(data.stepStatus)),
    listening: parseListening(data),
    expressions,
    practice: parsePractice(recordValue(data.practice), expressions),
    speaking: parseSpeaking(data),
    reading: parseReadingCard(data, expressions),
    review: parseReviewItems(data, expressions),
    weaknesses: parseWeaknesses(recordValue(data.weaknesses)),
    dashboard: parseDashboard(recordValue(data.dashboard)),
    completed: false
  };
}

export function parseSpeakingFeedback(rawContent: string): SpeakingFeedback {
  const data = parseStrictJsonObject(rawContent);

  return {
    fluency: scoreValue(data.fluency) ?? 70,
    grammar: scoreValue(data.grammar) ?? 70,
    vocabulary: scoreValue(data.vocabulary) ?? 70,
    naturalness: scoreValue(data.naturalness) ?? 70,
    suggestion: stringValue(data.suggestion) ?? "表达基本清楚，下一步重点放在更自然、更口语的说法上。",
    betterVersion:
      stringValue(data.betterVersion) ??
      stringValue(data.betterAnswer) ??
      "I would say it in a simpler, more natural way."
  };
}

function parseStrictJsonObject(rawContent: string): Record<string, unknown> {
  const cleaned = stripCodeFence(rawContent.trim());
  const candidates = [cleaned, extractFirstJsonObject(cleaned)].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);

      if (isRecord(data) && !Array.isArray(data)) {
        return data;
      }
    } catch {
      // Try the next candidate before reporting malformed JSON.
    }
  }

  throw new DailyTrainingParseError("AI returned malformed JSON.");
}

function parseListening(root: Record<string, unknown>): DailyTraining["listening"] {
  const data = recordValue(root.listening) ?? recordValue(root.listeningTask) ?? {};
  const resource =
    recordValue(data.resource) ??
    firstResource(root, "listening") ??
    fallbackListeningResource();
  const firstListen = recordValue(data.firstListen) ?? {};
  const secondListen = recordValue(data.secondListen) ?? {};

  return {
    resource: parseListeningResource(resource),
    firstListen: {
      instruction:
        stringValue(firstListen.instruction) ?? "第一遍：不看字幕，只抓大意。",
      questions: stringArray(firstListen.questions).slice(0, 5).length
        ? stringArray(firstListen.questions).slice(0, 5)
        : ["What is the topic?", "Who is speaking?", "What is the main idea?"]
    },
    secondListen: {
      instruction:
        stringValue(secondListen.instruction) ?? "第二遍：打开英文字幕，抓表达块。",
      task:
        stringValue(secondListen.task) ??
        stringValue(secondListen.extractionTarget) ??
        "写下 5 个你能马上用到的表达。"
    },
    transcript: stringValue(data.transcript)
  };
}

function parseListeningResource(data: Record<string, unknown>): ListeningResource {
  const fallback = fallbackListeningResource();
  const url = httpUrl(data.url) ?? stringValue(fallback.url) ?? "https://learningenglish.voanews.com/";
  const playerType =
    enumValue(data.playerType, validPlayerTypes) ??
    (extractBilibiliId(url) ? "bilibili" : extractYoutubeId(url) ? "youtube" : "web");
  const embedUrl =
    httpUrl(data.embedUrl) ??
    (playerType === "bilibili"
      ? toBilibiliEmbedUrl(url)
      : playerType === "youtube"
        ? toYoutubeEmbedUrl(url)
        : undefined);

  return {
    title: stringValue(data.title) ?? "English listening practice",
    source:
      stringValue(data.source) ??
      stringValue(data.websiteName) ??
      "VOA Learning English",
    url,
    embedUrl,
    audioUrl: httpUrl(data.audioUrl),
    level:
      stringValue(data.level) ??
      stringValue(data.difficulty) ??
      "IELTS 5.0-6.0",
    duration: stringValue(data.duration) ?? "5 分钟",
    playerType,
    whySuitable:
      stringValue(data.whySuitable) ??
      "语速相对清楚，适合先建立真实听力输入和常用表达库存。"
  };
}

function normalizeExpressions(root: Record<string, unknown>): TrainingExpression[] {
  const direct = arrayValue(root.expressions).map(parseExpression).filter(isNonNull);
  const fromChunks = arrayValue(root.chunks).map(parseExpressionFromChunk).filter(isNonNull);
  const fromVocabulary = arrayValue(root.vocabulary)
    .map(parseExpressionFromVocabulary)
    .filter(isNonNull);
  const merged = dedupeExpressions([...direct, ...fromChunks, ...fromVocabulary]);

  return fillExpressions(merged).slice(0, 8);
}

function parseExpression(value: unknown): TrainingExpression | null {
  const data = recordValue(value);

  if (!data) {
    return null;
  }

  const expression = stringValue(data.expression) ?? stringValue(data.text) ?? stringValue(data.word);

  if (!expression) {
    return null;
  }

  return {
    id: stringValue(data.id) ?? slugify(expression),
    expression,
    meaning: stringValue(data.meaning) ?? "常用口语表达",
    example:
      stringValue(data.example) ??
      stringValue(data.exampleSentence) ??
      `I can use "${expression}" in a real conversation.`,
    scenario: stringValue(data.scenario) ?? "日常真实交流",
    pronunciation: stringValue(data.pronunciation) ?? "按自然语流连读，不要逐词硬读。",
    difficulty: stringValue(data.difficulty) ?? "基础高频",
    favorite: booleanValue(data.favorite) ?? false,
    reviewDate: dateString(data.reviewDate) ?? addDays(getTodayKey(), 1),
    mastery: enumValue(data.mastery, validMastery) ?? "new"
  };
}

function parseExpressionFromChunk(value: unknown): TrainingExpression | null {
  const data = recordValue(value);

  if (!data) {
    return null;
  }

  return parseExpression({
    expression: data.expression,
    meaning: data.meaning,
    example: data.example,
    scenario: "表达块迁移",
    pronunciation: "注意弱读和连读。",
    difficulty: "基础高频",
    favorite: false,
    reviewDate: addDays(getTodayKey(), 1),
    mastery: "new"
  });
}

function parseExpressionFromVocabulary(value: unknown): TrainingExpression | null {
  const data = recordValue(value);

  if (!data) {
    return null;
  }

  const collocation = stringArray(data.commonCollocations)[0];
  const word = stringValue(data.word);

  return parseExpression({
    expression: collocation ?? word,
    meaning: stringValue(data.meaning),
    example: stringValue(data.exampleSentence),
    scenario: "词汇转表达块",
    pronunciation: "放进完整句子里练，不单独背。",
    difficulty: "基础高频",
    favorite: false,
    reviewDate: addDays(getTodayKey(), 1),
    mastery: "new"
  });
}

function parsePractice(
  data: Record<string, unknown> | undefined,
  expressions: TrainingExpression[]
): PracticeModule {
  const fillBlank = arrayValue(data?.fillBlank).map(parseFillBlank).filter(isNonNull);
  const replacements = arrayValue(data?.replacements).map(parseReplacement).filter(isNonNull);
  const sentenceBuilders = arrayValue(data?.sentenceBuilders)
    .map(parseSentenceBuilder)
    .filter(isNonNull);
  const firstExpression = expressions[0]?.expression ?? "be responsible for";
  const secondExpression = expressions[1]?.expression ?? "follow up on";

  return {
    fillBlank: fillBlank.length >= 2
      ? fillBlank.slice(0, 4)
      : [
          ...fillBlank,
          {
            id: "fill-responsible-for",
            prompt: "I am responsible ___ keeping the team updated.",
            answer: "for",
            hint: "responsible 后面常接 for"
          },
          {
            id: "fill-follow-up",
            prompt: "I will follow ___ with you tomorrow.",
            answer: "up",
            hint: "follow up = 跟进"
          }
        ].slice(0, 2),
    replacements: replacements.length
      ? replacements.slice(0, 2)
      : [
          {
            id: "replace-work-area",
            baseSentence: `I use "${firstExpression}" at work.`,
            targetWord: "work",
            replacements: ["a meeting", "a quick call", "a team update"],
            modelAnswer: `I use "${firstExpression}" in a meeting.`
          }
        ],
    sentenceBuilders: sentenceBuilders.length
      ? sentenceBuilders.slice(0, 3)
      : [
          {
            id: "builder-expression",
            keywords: secondExpression.split(/\s+/).slice(0, 5),
            modelAnswer: `I need to ${secondExpression} after the meeting.`,
            context: "用今天的表达说一句真实工作场景里的英文。"
          }
        ]
  };
}

function parseFillBlank(value: unknown): FillBlankPractice | null {
  const data = recordValue(value);
  const prompt = stringValue(data?.prompt);
  const answer = stringValue(data?.answer);

  return prompt && answer
    ? {
        id: stringValue(data?.id) ?? slugify(prompt),
        prompt,
        answer,
        hint: stringValue(data?.hint)
      }
    : null;
}

function parseReplacement(value: unknown): ReplacementPractice | null {
  const data = recordValue(value);
  const baseSentence = stringValue(data?.baseSentence);

  return baseSentence
    ? {
        id: stringValue(data?.id) ?? slugify(baseSentence),
        baseSentence,
        targetWord: stringValue(data?.targetWord) ?? "work",
        replacements: stringArray(data?.replacements).slice(0, 5),
        modelAnswer: stringValue(data?.modelAnswer) ?? baseSentence
      }
    : null;
}

function parseSentenceBuilder(value: unknown): SentenceBuilderPractice | null {
  const data = recordValue(value);
  const modelAnswer = stringValue(data?.modelAnswer);

  return modelAnswer
    ? {
        id: stringValue(data?.id) ?? slugify(modelAnswer),
        keywords: stringArray(data?.keywords).slice(0, 6),
        modelAnswer,
        context: stringValue(data?.context) ?? "用关键词组成一句自然口语。"
      }
    : null;
}

function parseSpeaking(root: Record<string, unknown>): DailyTraining["speaking"] {
  const data = recordValue(root.speaking) ?? recordValue(root.speakingTask) ?? {};

  return {
    question:
      stringValue(data.question) ??
      stringValue(data.topic) ??
      stringValue(data.requirement) ??
      "Introduce what you are responsible for at work in 30 seconds."
  };
}

function parseReadingCard(
  root: Record<string, unknown>,
  expressions: TrainingExpression[]
): ReadingCard {
  const data = recordValue(root.reading) ?? recordValue(root.readingTask) ?? {};
  const resource = recordValue(data.resource) ?? firstResource(root, "reading") ?? {};
  const highlights = arrayValue(data.highlightedExpressions)
    .map(parseReadingHighlight)
    .filter(isNonNull);
  const fallbackText = buildFallbackReading(expressions);

  return {
    title:
      stringValue(data.title) ??
      stringValue(resource.title) ??
      "A short workplace update",
    source:
      stringValue(data.source) ??
      stringValue(resource.source) ??
      stringValue(resource.websiteName) ??
      "Daily Training",
    url: httpUrl(data.url) ?? httpUrl(resource.url) ?? "https://learningenglish.voanews.com/",
    level:
      stringValue(data.level) ??
      stringValue(resource.difficulty) ??
      "IELTS 5.0-6.0",
    text: normalizeReadingText(stringValue(data.text), fallbackText),
    zhAssist:
      stringValue(data.zhAssist) ??
      "阅读时不要逐句翻译，先抓主题，再圈出能放进口语里的表达。",
    highlightedExpressions: highlights.length
      ? highlights.slice(0, 8)
      : expressions.slice(0, 5).map((item) => ({
          expression: item.expression,
          meaning: item.meaning,
          example: item.example
        }))
  };
}

function parseReadingHighlight(value: unknown): ReadingHighlight | null {
  const data = recordValue(value);
  const expression = stringValue(data?.expression);

  return expression
    ? {
        expression,
        meaning: stringValue(data?.meaning) ?? "可复用表达",
        example: stringValue(data?.example) ?? `Try to use "${expression}" in your own sentence.`
      }
    : null;
}

function parseReviewItems(
  root: Record<string, unknown>,
  expressions: TrainingExpression[]
): ReviewItem[] {
  const review = arrayValue(root.review).map(parseReviewItem).filter(isNonNull);

  if (review.length) {
    return review.slice(0, 8);
  }

  return expressions.slice(0, 2).map((item) => ({
    expressionId: item.id,
    expression: item.expression,
    meaning: item.meaning,
    dueDate: getTodayKey(),
    prompt: "用这个表达重新造一句自己的真实句子。"
  }));
}

function parseReviewItem(value: unknown): ReviewItem | null {
  const data = recordValue(value);
  const expression = stringValue(data?.expression);

  return expression
    ? {
        expressionId: stringValue(data?.expressionId) ?? slugify(expression),
        expression,
        meaning: stringValue(data?.meaning) ?? "复习表达",
        dueDate: dateString(data?.dueDate) ?? getTodayKey(),
        prompt: stringValue(data?.prompt) ?? "用这个表达重新造一句自己的真实句子。"
      }
    : null;
}

function parseWeaknesses(data?: Record<string, unknown>): WeaknessTracking {
  return {
    listening: withFallback(stringArray(data?.listening), ["真实语速适应"]),
    expression: withFallback(stringArray(data?.expression), ["表达块积累不足"]),
    speaking: withFallback(stringArray(data?.speaking), ["句型容易重复"]),
    reading: withFallback(stringArray(data?.reading), ["阅读表达迁移"])
  };
}

function parseDashboard(data?: Record<string, unknown>): ProgressDashboard {
  return {
    totalDays: nonNegativeInteger(data?.totalDays) ?? 0,
    learnedExpressions: nonNegativeInteger(data?.learnedExpressions) ?? 0,
    listeningMinutes: nonNegativeInteger(data?.listeningMinutes) ?? 0,
    speakingPracticeCount: nonNegativeInteger(data?.speakingPracticeCount) ?? 0,
    reviewAccuracy: scoreValue(data?.reviewAccuracy) ?? 0
  };
}

function parseStepStatus(data?: Record<string, unknown>): DailyTraining["stepStatus"] {
  return validSteps.reduce(
    (status, step) => ({
      ...status,
      [step]: booleanValue(data?.[step]) ?? false
    }),
    {} as DailyTraining["stepStatus"]
  );
}

function firstResource(root: Record<string, unknown>, type: "listening" | "reading") {
  return arrayValue(root.resources)
    .map(recordValue)
    .find((item) => item && stringValue(item.type) === type);
}

function fallbackListeningResource(): Record<string, unknown> {
  return {
    title: "VOA Learning English",
    source: "VOA Learning English",
    url: "https://learningenglish.voanews.com/",
    level: "IELTS 5.0-6.0",
    duration: "5 分钟",
    playerType: "web",
    whySuitable: "清晰、慢速、适合建立听力输入习惯。"
  };
}

function fillExpressions(expressions: TrainingExpression[]): TrainingExpression[] {
  const fallback = [
    ["be responsible for", "负责某事", "I am responsible for updating the client every week."],
    ["follow up on", "继续跟进", "I will follow up on this after the meeting."],
    ["get back to someone", "稍后回复某人", "I will get back to you this afternoon."],
    ["figure out", "弄清楚", "Let me figure out what happened first."],
    ["make it work", "想办法搞定", "The schedule is tight, but we can make it work."]
  ].map(([expression, meaning, example]) => ({
    id: slugify(expression),
    expression,
    meaning,
    example,
    scenario: "日常和职场交流",
    pronunciation: "自然连读，重音放在核心信息上。",
    difficulty: "基础高频",
    favorite: false,
    reviewDate: addDays(getTodayKey(), 1),
    mastery: "new" as const
  }));

  return dedupeExpressions([...expressions, ...fallback]);
}

function dedupeExpressions(expressions: TrainingExpression[]): TrainingExpression[] {
  const seen = new Set<string>();

  return expressions.filter((item) => {
    const key = item.expression.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildFallbackReading(expressions: TrainingExpression[]): string {
  const [first, second] = expressions;

  return [
    "At work, clear communication often matters more than complicated English.",
    `When you explain your role, you can say "${first?.expression ?? "be responsible for"}" and then give one simple example.`,
    `When you need more time, "${second?.expression ?? "get back to someone"}" sounds natural and polite.`,
    "The goal is not to sound formal. The goal is to sound clear, calm, and useful in a real conversation.",
    "After reading, choose one expression and use it in your own situation today."
  ].join(" ");
}

function normalizeReadingText(text: string | undefined, fallback: string): string {
  if (!text) {
    return fallback;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return wordCount < 40 ? `${text} ${fallback}` : text;
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonObject(value: string): string {
  const start = value.indexOf("{");

  if (start < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return "";
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) && !Array.isArray(value) ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(isNonEmptyString).map((item) => item.trim())
    : [];
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function scoreValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : undefined;
}

function dateString(value: unknown): string | undefined {
  const text = stringValue(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function httpUrl(value: unknown): string | undefined {
  const text = stringValue(value);

  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? text : undefined;
  } catch {
    return undefined;
  }
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T
): T[number] | undefined {
  const text = stringValue(value);
  return text && allowed.includes(text) ? text : undefined;
}

function inferPhase(dayNumber: number): TrainingPhase {
  if (dayNumber <= 60) {
    return "phase1-foundation";
  }

  return dayNumber <= 120 ? "phase2-bridge" : "phase3-ielts7";
}

function withFallback(values: string[], fallback: string[]): string[] {
  return values.length ? values.slice(0, 5) : fallback;
}

function toYoutubeEmbedUrl(url: string): string | undefined {
  const id = extractYoutubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : undefined;
}

function toBilibiliEmbedUrl(url: string): string | undefined {
  const id = extractBilibiliId(url);
  return id ? `https://player.bilibili.com/player.html?bvid=${id}&page=1&autoplay=0` : undefined;
}

function extractBilibiliId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("bvid");

    if (fromQuery?.startsWith("BV")) {
      return fromQuery;
    }

    const match = parsed.pathname.match(/BV[a-zA-Z0-9]+/);
    return match?.[0];
  } catch {
    return undefined;
  }
}

function extractYoutubeId(url: string): string | undefined {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || undefined;
    }

    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v") ?? parsed.pathname.split("/").pop() ?? undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return slug || `item-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(date: string, days: number): string {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
