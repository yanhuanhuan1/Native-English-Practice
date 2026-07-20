import type {
  ComprehensionQuestion,
  DailyTraining,
  DictationExercise,
  ExpressionMastery,
  LearningItem,
  LearningItemMastery,
  LearningItemType,
  LessonReviewSummary,
  ListeningPlayerType,
  ListeningResource,
  OutputTask,
  PracticeModule,
  ProgressDashboard,
  ReadingCard,
  ReviewItem,
  ShadowingTask,
  SpeakingFeedback,
  TrainingExpression,
  TrainingLevel,
  TrainingPhase,
  TrainingStep,
  TranscriptSegment,
  WeaknessTracking
} from "@/types/daily-training";

export class DailyTrainingParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyTrainingParseError";
  }
}

const validLevels: TrainingLevel[] = ["IELTS 5.0-6.0", "IELTS 6.0-6.5", "IELTS 7+"];
const validPhases: TrainingPhase[] = ["phase1-foundation", "phase2-bridge", "phase3-ielts7"];
const validSteps: TrainingStep[] = ["listening", "expression", "practice", "speaking", "review"];
const validPlayerTypes: ListeningPlayerType[] = ["bilibili", "youtube", "audio", "web"];
const validMastery: ExpressionMastery[] = ["new", "learning", "mastered"];
const validLearningTypes: LearningItemType[] = [
  "vocabulary",
  "expression",
  "pronunciation",
  "connectedSpeech"
];
const validLearningMastery: LearningItemMastery[] = [
  "unknown",
  "fuzzy",
  "known-passive",
  "active"
];

export function parseEnglishTrainingDay(rawContent: string): DailyTraining {
  const data = parseStrictJsonObject(rawContent);
  const dayNumber = positiveInteger(data.dayNumber) ?? 1;
  const level = enumValue(data.level, validLevels) ?? "IELTS 5.0-6.0";
  const phase = enumValue(data.phase, validPhases) ?? inferPhase(dayNumber);
  const listening = parseListening(data);
  const transcriptSegments = parseTranscriptSegments(data, listening.transcript);
  const learningItems = normalizeLearningItems(data, transcriptSegments);
  const expressions = normalizeExpressions(data, learningItems);

  return {
    date: dateString(data.date) ?? getTodayKey(),
    dayNumber,
    level,
    phase,
    topic: stringValue(data.topic) ?? "Workplace Communication",
    activeStep: enumValue(data.activeStep, validSteps) ?? "listening",
    stepStatus: parseStepStatus(recordValue(data.stepStatus)),
    listening,
    transcriptSource: transcriptSegments.length
      ? enumValue(data.transcriptSource, ["official", "auto", "asr", "unavailable"] as const) ??
        "auto"
      : "unavailable",
    transcriptSegments,
    learningItems,
    dictation: parseDictation(data, transcriptSegments),
    comprehension: parseComprehension(data),
    shadowing: parseShadowing(data, transcriptSegments),
    outputTask: parseOutputTask(data, learningItems),
    lessonReview: parseLessonReview(data, learningItems, transcriptSegments),
    expressions,
    practice: parsePractice(transcriptSegments),
    speaking: {
      question:
        stringValue(recordValue(data.outputTask)?.prompt) ??
        stringValue(recordValue(data.speaking)?.question) ??
        "Use three expressions from this lesson to introduce yourself."
    },
    reading: parseReadingCard(data, transcriptSegments, learningItems),
    review: parseReviewItems(data, learningItems),
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
    suggestion: stringValue(data.suggestion) ?? "表达基本清楚，继续练自然口语表达。",
    betterVersion:
      stringValue(data.betterVersion) ??
      stringValue(data.betterAnswer) ??
      "Try saying it in a simpler, more natural way."
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
      // Try the next candidate.
    }
  }

  throw new DailyTrainingParseError("AI returned malformed JSON.");
}

function parseListening(root: Record<string, unknown>): DailyTraining["listening"] {
  const data = recordValue(root.listening) ?? recordValue(root.listeningTask) ?? {};
  const resource =
    recordValue(data.resource) ?? firstResource(root, "listening") ?? fallbackListeningResource();

  return {
    resource: parseListeningResource(resource),
    firstListen: {
      instruction: "播放视频，先不看中文，跟随逐句文本精听。",
      questions: ["What is happening?", "Who is speaking?", "Which expression can you reuse?"]
    },
    secondListen: {
      instruction: "用逐句转录定位没听清的地方。",
      task: "完成本课 3-5 句精听和跟读。"
    },
    transcript: stringValue(data.transcript)
  };
}

function parseListeningResource(data: Record<string, unknown>): ListeningResource {
  const fallback = fallbackListeningResource();
  const url =
    httpUrl(data.url) ?? stringValue(fallback.url) ?? "https://search.bilibili.com/all?keyword=BBC%20Learning%20English";
  const playerType =
    enumValue(data.playerType, validPlayerTypes) ??
    (extractBilibiliId(url) ? "bilibili" : extractYoutubeId(url) ? "youtube" : "web");

  return {
    title: stringValue(data.title) ?? "English listening practice",
    source: stringValue(data.source) ?? stringValue(data.websiteName) ?? "Bilibili",
    url,
    embedUrl:
      httpUrl(data.embedUrl) ??
      (playerType === "bilibili"
        ? toBilibiliEmbedUrl(url)
        : playerType === "youtube"
          ? toYoutubeEmbedUrl(url)
          : undefined),
    audioUrl: httpUrl(data.audioUrl),
    level: stringValue(data.level) ?? stringValue(data.difficulty) ?? "B1 / IELTS 5.0-5.5",
    duration: stringValue(data.duration) ?? "5 minutes",
    playerType,
    whySuitable: stringValue(data.whySuitable) ?? "适合进行逐句精听和表达积累。"
  };
}

function parseTranscriptSegments(
  root: Record<string, unknown>,
  transcript?: string
): TranscriptSegment[] {
  const segments = arrayValue(root.transcriptSegments)
    .map(parseTranscriptSegment)
    .filter(isNonNull);

  if (segments.length) {
    return segments.slice(0, 80);
  }

  const listening = recordValue(root.listening) ?? {};
  const nested = arrayValue(listening.transcriptSegments)
    .map(parseTranscriptSegment)
    .filter(isNonNull);

  if (nested.length) {
    return nested.slice(0, 80);
  }

  if (!transcript) {
    return [];
  }

  return transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((text, index) => ({
      id: `segment-${index + 1}`,
      startTime: index * 8,
      endTime: index * 8 + 7,
      speaker: "Speaker",
      text,
      translation: undefined,
      vocabularyIds: [],
      expressionIds: [],
      markedUnclear: false,
      completed: false
    }));
}

function parseTranscriptSegment(value: unknown): TranscriptSegment | null {
  const data = recordValue(value);
  const text = stringValue(data?.text);

  if (!text) {
    return null;
  }

  const startTime = numberValue(data?.startTime) ?? parseTimestamp(stringValue(data?.startTime)) ?? 0;
  const endTime =
    numberValue(data?.endTime) ?? parseTimestamp(stringValue(data?.endTime)) ?? startTime + 6;

  return {
    id: stringValue(data?.id) ?? `segment-${slugify(text).slice(0, 18)}`,
    startTime,
    endTime: Math.max(endTime, startTime + 1),
    speaker: stringValue(data?.speaker) ?? "Speaker",
    text,
    translation: stringValue(data?.translation),
    vocabularyIds: stringArray(data?.vocabularyIds),
    expressionIds: stringArray(data?.expressionIds),
    markedUnclear: booleanValue(data?.markedUnclear) ?? false,
    completed: booleanValue(data?.completed) ?? false
  };
}

function normalizeLearningItems(
  root: Record<string, unknown>,
  segments: TranscriptSegment[]
): LearningItem[] {
  const direct = arrayValue(root.learningItems).map(parseLearningItem).filter(isNonNull);
  const fromExpressions = arrayValue(root.expressions).map((value) =>
    parseLearningItemFromExpression(value, segments)
  ).filter(isNonNull);
  const merged = dedupeLearningItems([...direct, ...fromExpressions]);

  if (merged.length) {
    return merged.slice(0, 12);
  }

  return buildFallbackLearningItems(segments).slice(0, 8);
}

function parseLearningItem(value: unknown): LearningItem | null {
  const data = recordValue(value);
  const text = stringValue(data?.text) ?? stringValue(data?.expression) ?? stringValue(data?.word);

  if (!text) {
    return null;
  }

  return {
    id: stringValue(data?.id) ?? slugify(text),
    type: enumValue(data?.type, validLearningTypes) ?? "expression",
    text,
    meaning: stringValue(data?.meaning) ?? "可复用表达",
    pronunciation: stringValue(data?.pronunciation) ?? "注意自然连读和重音。",
    sourceSentence: stringValue(data?.sourceSentence) ?? stringValue(data?.example) ?? text,
    sourceStartTime: numberValue(data?.sourceStartTime) ?? 0,
    collocations: stringArray(data?.collocations).slice(0, 5),
    reusableExample:
      stringValue(data?.reusableExample) ??
      stringValue(data?.example) ??
      `I can use "${text}" in a real conversation.`,
    level: stringValue(data?.level) ?? "B1",
    saved: booleanValue(data?.saved) ?? false,
    mastery: enumValue(data?.mastery, validLearningMastery) ?? "unknown"
  };
}

function parseLearningItemFromExpression(
  value: unknown,
  segments: TranscriptSegment[]
): LearningItem | null {
  const data = recordValue(value);
  const expression = stringValue(data?.expression) ?? stringValue(data?.text);

  if (!expression) {
    return null;
  }

  const sourceSegment =
    segments.find((segment) => segment.text.toLowerCase().includes(expression.toLowerCase())) ??
    segments[0];

  return {
    id: stringValue(data?.id) ?? slugify(expression),
    type: "expression",
    text: expression,
    meaning: stringValue(data?.meaning) ?? "可复用表达",
    pronunciation: stringValue(data?.pronunciation) ?? "放进整句里读。",
    sourceSentence: sourceSegment?.text ?? stringValue(data?.example) ?? expression,
    sourceStartTime: sourceSegment?.startTime ?? 0,
    collocations: [],
    reusableExample:
      stringValue(data?.reusableExample) ??
      stringValue(data?.example) ??
      `Try using "${expression}" in your own answer.`,
    level: stringValue(data?.difficulty) ?? "B1",
    saved: false,
    mastery: "unknown"
  };
}

function parseDictation(
  root: Record<string, unknown>,
  segments: TranscriptSegment[]
): DictationExercise[] {
  const direct = arrayValue(root.dictation).map(parseDictationExercise).filter(isNonNull);

  if (direct.length) {
    return direct.slice(0, 5);
  }

  return segments
    .filter((segment) => segment.text.split(/\s+/).length >= 5)
    .slice(0, 5)
    .map((segment) => ({
      segmentId: segment.id,
      userAnswer: "",
      correctText: segment.text,
      missingWords: [],
      incorrectWords: [],
      completed: false,
      hint: "先播放原句，再凭声音输入你听到的内容。"
    }));
}

function parseDictationExercise(value: unknown): DictationExercise | null {
  const data = recordValue(value);
  const segmentId = stringValue(data?.segmentId);
  const correctText = stringValue(data?.correctText);

  return segmentId && correctText
    ? {
        segmentId,
        userAnswer: stringValue(data?.userAnswer) ?? "",
        correctText,
        missingWords: stringArray(data?.missingWords),
        incorrectWords: stringArray(data?.incorrectWords),
        completed: booleanValue(data?.completed) ?? false,
        hint: stringValue(data?.hint)
      }
    : null;
}

function parseComprehension(root: Record<string, unknown>): ComprehensionQuestion[] {
  return arrayValue(root.comprehension)
    .map(parseComprehensionQuestion)
    .filter(isNonNull)
    .slice(0, 3);
}

function parseComprehensionQuestion(value: unknown): ComprehensionQuestion | null {
  const data = recordValue(value);
  const question = stringValue(data?.question);
  const answer = stringValue(data?.answer);

  return question && answer
    ? {
        id: stringValue(data?.id) ?? slugify(question),
        type:
          enumValue(data?.type, ["mainIdea", "relationship", "keyInfo", "meaning"] as const) ??
          "mainIdea",
        question,
        options: stringArray(data?.options).slice(0, 4),
        answer,
        explanation: stringValue(data?.explanation) ?? "基于视频内容判断。",
        userAnswer: stringValue(data?.userAnswer),
        completed: booleanValue(data?.completed) ?? false
      }
    : null;
}

function parseShadowing(
  root: Record<string, unknown>,
  segments: TranscriptSegment[]
): ShadowingTask {
  const data = recordValue(root.shadowing) ?? {};

  return {
    segmentIds: stringArray(data.segmentIds).length
      ? stringArray(data.segmentIds).slice(0, 5)
      : segments.slice(0, 3).map((segment) => segment.id),
    recordings: recordOfStrings(data.recordings),
    completed: booleanValue(data.completed) ?? false
  };
}

function parseOutputTask(root: Record<string, unknown>, learningItems: LearningItem[]): OutputTask {
  const data = recordValue(root.outputTask) ?? recordValue(root.speaking) ?? {};

  return {
    prompt:
      stringValue(data.prompt) ??
      stringValue(data.question) ??
      "Imagine you are joining a new team. Introduce yourself and use at least three expressions from this lesson.",
    requiredItemIds: stringArray(data.requiredItemIds).length
      ? stringArray(data.requiredItemIds).slice(0, 3)
      : learningItems.slice(0, 3).map((item) => item.id),
    recordingUrl: stringValue(data.recordingUrl),
    transcript: stringValue(data.transcript),
    feedback: stringValue(data.feedback),
    completed: booleanValue(data.completed) ?? false
  };
}

function parseLessonReview(
  root: Record<string, unknown>,
  learningItems: LearningItem[],
  segments: TranscriptSegment[]
): LessonReviewSummary {
  const data = recordValue(root.lessonReview) ?? {};

  return {
    expressions: stringArray(data.expressions).length
      ? stringArray(data.expressions).slice(0, 3)
      : learningItems.slice(0, 3).map((item) => item.text),
    soundIssues: stringArray(data.soundIssues).length
      ? stringArray(data.soundIssues).slice(0, 2)
      : learningItems
          .filter((item) => item.type === "pronunciation" || item.type === "connectedSpeech")
          .slice(0, 2)
          .map((item) => item.text),
    reviewSentence:
      stringValue(data.reviewSentence) ?? segments[0]?.text ?? "Review one useful sentence from today.",
    addedToReview: booleanValue(data.addedToReview) ?? false
  };
}

function normalizeExpressions(
  root: Record<string, unknown>,
  learningItems: LearningItem[]
): TrainingExpression[] {
  const direct = arrayValue(root.expressions)
    .map(parseExpression)
    .filter(isNonNull);
  const fromItems = learningItems.map((item) => ({
    id: item.id,
    expression: item.text,
    meaning: item.meaning,
    example: item.reusableExample,
    scenario: "本课视频语境",
    pronunciation: item.pronunciation,
    difficulty: item.level,
    favorite: item.saved,
    reviewDate: addDays(getTodayKey(), 1),
    mastery: "new" as const
  }));

  return dedupeExpressions([...direct, ...fromItems]).slice(0, 8);
}

function parseExpression(value: unknown): TrainingExpression | null {
  const data = recordValue(value);
  const expression = stringValue(data?.expression) ?? stringValue(data?.text) ?? stringValue(data?.word);

  return expression
    ? {
        id: stringValue(data?.id) ?? slugify(expression),
        expression,
        meaning: stringValue(data?.meaning) ?? "常用表达",
        example: stringValue(data?.example) ?? stringValue(data?.exampleSentence) ?? expression,
        scenario: stringValue(data?.scenario) ?? "真实口语语境",
        pronunciation: stringValue(data?.pronunciation) ?? "自然连读。",
        difficulty: stringValue(data?.difficulty) ?? "B1",
        favorite: booleanValue(data?.favorite) ?? false,
        reviewDate: dateString(data?.reviewDate) ?? addDays(getTodayKey(), 1),
        mastery: enumValue(data?.mastery, validMastery) ?? "new"
      }
    : null;
}

function parsePractice(segments: TranscriptSegment[]): PracticeModule {
  return {
    fillBlank: segments.slice(0, 2).map((segment) => ({
      id: `fill-${segment.id}`,
      prompt: hideOneWord(segment.text),
      answer: pickHiddenWord(segment.text),
      hint: "来自本课转录句。"
    })),
    replacements: [],
    sentenceBuilders: []
  };
}

function parseReadingCard(
  root: Record<string, unknown>,
  segments: TranscriptSegment[],
  learningItems: LearningItem[]
): ReadingCard {
  const resource = parseListening(root).resource;

  return {
    title: resource.title,
    source: resource.source,
    url: resource.url,
    level: resource.level,
    text: segments.map((segment) => segment.text).join(" "),
    zhAssist: "本页阅读文本来自视频逐句转录。",
    highlightedExpressions: learningItems.slice(0, 8).map((item) => ({
      expression: item.text,
      meaning: item.meaning,
      example: item.reusableExample
    }))
  };
}

function parseReviewItems(
  root: Record<string, unknown>,
  learningItems: LearningItem[]
): ReviewItem[] {
  const direct = arrayValue(root.review).map(parseReviewItem).filter(isNonNull);

  if (direct.length) {
    return direct.slice(0, 8);
  }

  return learningItems.slice(0, 3).map((item) => ({
    expressionId: item.id,
    expression: item.text,
    meaning: item.meaning,
    dueDate: addDays(getTodayKey(), 1),
    prompt: "用这个表达造一句自己的真实句子。"
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
        dueDate: dateString(data?.dueDate) ?? addDays(getTodayKey(), 1),
        prompt: stringValue(data?.prompt) ?? "用这个表达造一句自己的真实句子。"
      }
    : null;
}

function parseWeaknesses(data?: Record<string, unknown>): WeaknessTracking {
  return {
    listening: stringArray(data?.listening).slice(0, 5),
    expression: stringArray(data?.expression).slice(0, 5),
    speaking: stringArray(data?.speaking).slice(0, 5),
    reading: stringArray(data?.reading).slice(0, 5)
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

function buildFallbackLearningItems(segments: TranscriptSegment[]): LearningItem[] {
  const source = segments[0];

  if (!source) {
    return [];
  }

  return [
    {
      id: "source-expression",
      type: "expression",
      text: source.text.split(/\s+/).slice(0, 4).join(" "),
      meaning: "本句中的可复用表达",
      pronunciation: "听原句，注意重音和弱读。",
      sourceSentence: source.text,
      sourceStartTime: source.startTime,
      collocations: [],
      reusableExample: source.text,
      level: "B1",
      saved: false,
      mastery: "unknown"
    }
  ];
}

function dedupeLearningItems(items: LearningItem[]): LearningItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.text.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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

function firstResource(root: Record<string, unknown>, type: "listening" | "reading") {
  return arrayValue(root.resources)
    .map(recordValue)
    .find((item) => item && stringValue(item.type) === type);
}

function fallbackListeningResource(): Record<string, unknown> {
  return {
    title: "Bilibili English listening practice",
    source: "Bilibili",
    url: "https://search.bilibili.com/all?keyword=BBC%20Learning%20English",
    level: "B1 / IELTS 5.0-5.5",
    duration: "5 minutes",
    playerType: "web",
    whySuitable: "用于查找可播放英语听力资源。"
  };
}

function hideOneWord(text: string): string {
  const word = pickHiddenWord(text);
  return word ? text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), "___") : text;
}

function pickHiddenWord(text: string): string {
  return (
    text
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z']/g, ""))
      .find((word) => word.length > 4) ?? ""
  );
}

function recordOfStrings(value: unknown): Record<string, string> {
  const data = recordValue(value) ?? {};
  return Object.fromEntries(
    Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value.split(":").map(Number);

  if (parts.some((part) => Number.isNaN(part))) {
    return undefined;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
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

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

    return parsed.pathname.match(/BV[a-zA-Z0-9]+/)?.[0];
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
