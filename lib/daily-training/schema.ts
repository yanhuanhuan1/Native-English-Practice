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

const validPlayerTypes: ListeningPlayerType[] = ["youtube", "audio", "web"];
const validMastery: ExpressionMastery[] = ["new", "learning", "mastered"];

export function parseEnglishTrainingDay(rawContent: string): DailyTraining {
  const data = parseStrictJsonObject(rawContent);
  const dayNumber = requirePositiveInteger(data, "dayNumber");
  const expressions = requireArray(data, "expressions", parseExpression).slice(0, 8);

  if (expressions.length < 5) {
    throw new DailyTrainingParseError("Training day must include at least 5 expressions.");
  }

  return {
    date: requireDateString(data, "date"),
    dayNumber,
    level: requireEnum(data, "level", validLevels),
    phase: requireEnum(data, "phase", validPhases),
    topic: requireString(data, "topic"),
    activeStep: normalizeStep(optionalString(data, "activeStep") ?? "listening"),
    stepStatus: parseStepStatus(optionalRecord(data, "stepStatus")),
    listening: parseListening(requireRecord(data, "listening")),
    expressions,
    practice: parsePractice(requireRecord(data, "practice")),
    speaking: {
      question: requireString(requireRecord(data, "speaking"), "question")
    },
    reading: parseReadingCard(requireRecord(data, "reading")),
    review: requireArray(data, "review", parseReviewItem).slice(0, 8),
    weaknesses: parseWeaknesses(requireRecord(data, "weaknesses")),
    dashboard: parseDashboard(requireRecord(data, "dashboard")),
    completed: false
  };
}

export function parseSpeakingFeedback(rawContent: string): SpeakingFeedback {
  const data = parseStrictJsonObject(rawContent);

  return {
    fluency: requireScore(data, "fluency"),
    grammar: requireScore(data, "grammar"),
    vocabulary: requireScore(data, "vocabulary"),
    naturalness: requireScore(data, "naturalness"),
    suggestion: requireString(data, "suggestion"),
    betterVersion: requireString(data, "betterVersion")
  };
}

function parseStrictJsonObject(rawContent: string): Record<string, unknown> {
  let data: unknown;

  try {
    data = JSON.parse(rawContent);
  } catch {
    throw new DailyTrainingParseError("AI returned malformed JSON.");
  }

  if (!isRecord(data) || Array.isArray(data)) {
    throw new DailyTrainingParseError("AI JSON response must be an object.");
  }

  return data;
}

function parseListening(data: Record<string, unknown>): DailyTraining["listening"] {
  const secondListen = requireRecord(data, "secondListen");

  return {
    resource: parseListeningResource(requireRecord(data, "resource")),
    firstListen: {
      instruction: requireString(requireRecord(data, "firstListen"), "instruction"),
      questions: requireStringArray(requireRecord(data, "firstListen"), "questions").slice(0, 5)
    },
    secondListen: {
      instruction: requireString(secondListen, "instruction"),
      task: requireString(secondListen, "task")
    },
    transcript: optionalString(data, "transcript")
  };
}

function parseListeningResource(data: Record<string, unknown>): ListeningResource {
  const url = requireHttpUrl(data, "url");
  const playerType = requireEnum(data, "playerType", validPlayerTypes);
  const embedUrl =
    optionalHttpUrl(data, "embedUrl") ?? (playerType === "youtube" ? toYoutubeEmbedUrl(url) : undefined);

  return {
    title: requireString(data, "title"),
    source: requireString(data, "source"),
    url,
    embedUrl,
    audioUrl: optionalHttpUrl(data, "audioUrl"),
    level: requireString(data, "level"),
    duration: requireString(data, "duration"),
    playerType,
    whySuitable: requireString(data, "whySuitable")
  };
}

function parseExpression(value: unknown): TrainingExpression {
  const data = ensureRecord(value, "expression");

  return {
    id: optionalString(data, "id") ?? slugify(requireString(data, "expression")),
    expression: requireString(data, "expression"),
    meaning: requireString(data, "meaning"),
    example: requireString(data, "example"),
    scenario: requireString(data, "scenario"),
    pronunciation: requireString(data, "pronunciation"),
    difficulty: requireString(data, "difficulty"),
    favorite: optionalBoolean(data, "favorite") ?? false,
    reviewDate: requireDateString(data, "reviewDate"),
    mastery: requireEnum(data, "mastery", validMastery)
  };
}

function parsePractice(data: Record<string, unknown>): PracticeModule {
  const fillBlank = requireArray(data, "fillBlank", parseFillBlank).slice(0, 4);
  const replacements = requireArray(data, "replacements", parseReplacement).slice(0, 2);
  const sentenceBuilders = requireArray(data, "sentenceBuilders", parseSentenceBuilder).slice(0, 3);

  if (fillBlank.length < 2 || replacements.length < 1 || sentenceBuilders.length < 1) {
    throw new DailyTrainingParseError("Practice module must include fill blank, replacement, and sentence builder tasks.");
  }

  return { fillBlank, replacements, sentenceBuilders };
}

function parseFillBlank(value: unknown): FillBlankPractice {
  const data = ensureRecord(value, "fill blank practice");

  return {
    id: optionalString(data, "id") ?? slugify(requireString(data, "prompt")),
    prompt: requireString(data, "prompt"),
    answer: requireString(data, "answer"),
    hint: optionalString(data, "hint")
  };
}

function parseReplacement(value: unknown): ReplacementPractice {
  const data = ensureRecord(value, "replacement practice");

  return {
    id: optionalString(data, "id") ?? slugify(requireString(data, "baseSentence")),
    baseSentence: requireString(data, "baseSentence"),
    targetWord: requireString(data, "targetWord"),
    replacements: requireStringArray(data, "replacements").slice(0, 5),
    modelAnswer: requireString(data, "modelAnswer")
  };
}

function parseSentenceBuilder(value: unknown): SentenceBuilderPractice {
  const data = ensureRecord(value, "sentence builder practice");

  return {
    id: optionalString(data, "id") ?? slugify(requireString(data, "modelAnswer")),
    keywords: requireStringArray(data, "keywords").slice(0, 6),
    modelAnswer: requireString(data, "modelAnswer"),
    context: requireString(data, "context")
  };
}

function parseReadingCard(data: Record<string, unknown>): ReadingCard {
  const text = requireString(data, "text");
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 80 || wordCount > 230) {
    throw new DailyTrainingParseError("Reading card must be around 100-200 words.");
  }

  return {
    title: requireString(data, "title"),
    source: requireString(data, "source"),
    url: requireHttpUrl(data, "url"),
    level: requireString(data, "level"),
    text,
    zhAssist: requireString(data, "zhAssist"),
    highlightedExpressions: requireArray(
      data,
      "highlightedExpressions",
      parseReadingHighlight
    ).slice(0, 8)
  };
}

function parseReadingHighlight(value: unknown): ReadingHighlight {
  const data = ensureRecord(value, "reading highlight");

  return {
    expression: requireString(data, "expression"),
    meaning: requireString(data, "meaning"),
    example: requireString(data, "example")
  };
}

function parseReviewItem(value: unknown): ReviewItem {
  const data = ensureRecord(value, "review item");

  return {
    expressionId: requireString(data, "expressionId"),
    expression: requireString(data, "expression"),
    meaning: requireString(data, "meaning"),
    dueDate: requireDateString(data, "dueDate"),
    prompt: requireString(data, "prompt")
  };
}

function parseWeaknesses(data: Record<string, unknown>): WeaknessTracking {
  return {
    listening: requireStringArray(data, "listening").slice(0, 5),
    expression: requireStringArray(data, "expression").slice(0, 5),
    speaking: requireStringArray(data, "speaking").slice(0, 5),
    reading: requireStringArray(data, "reading").slice(0, 5)
  };
}

function parseDashboard(data: Record<string, unknown>): ProgressDashboard {
  return {
    totalDays: requireNonNegativeInteger(data, "totalDays"),
    learnedExpressions: requireNonNegativeInteger(data, "learnedExpressions"),
    listeningMinutes: requireNonNegativeInteger(data, "listeningMinutes"),
    speakingPracticeCount: requireNonNegativeInteger(data, "speakingPracticeCount"),
    reviewAccuracy: requireScore(data, "reviewAccuracy")
  };
}

function parseStepStatus(data?: Record<string, unknown>) {
  return validSteps.reduce(
    (status, step) => ({
      ...status,
      [step]: typeof data?.[step] === "boolean" ? data[step] : false
    }),
    {} as DailyTraining["stepStatus"]
  );
}

function requireRecord(data: Record<string, unknown>, key: string): Record<string, unknown> {
  return ensureRecord(data[key], key);
}

function optionalRecord(data: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = data[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  return ensureRecord(value, key);
}

function ensureRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new DailyTrainingParseError(`${label} must be an object.`);
  }

  return value;
}

function requireArray<T>(
  data: Record<string, unknown>,
  key: string,
  parser: (value: unknown) => T
): T[] {
  const value = data[key];

  if (!Array.isArray(value)) {
    throw new DailyTrainingParseError(`Field "${key}" must be an array.`);
  }

  return value.map(parser);
}

function requireString(data: Record<string, unknown>, key: string): string {
  const value = data[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DailyTrainingParseError(`Field "${key}" must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new DailyTrainingParseError(`Field "${key}" must be a string when present.`);
  }

  return value.trim() || undefined;
}

function requireStringArray(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new DailyTrainingParseError(`Field "${key}" must be an array of non-empty strings.`);
  }

  return value.map((item) => item.trim());
}

function requirePositiveInteger(data: Record<string, unknown>, key: string): number {
  const value = data[key];

  if (!Number.isInteger(value) || typeof value !== "number" || value < 1) {
    throw new DailyTrainingParseError(`Field "${key}" must be a positive integer.`);
  }

  return value;
}

function requireNonNegativeInteger(data: Record<string, unknown>, key: string): number {
  const value = data[key];

  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) {
    throw new DailyTrainingParseError(`Field "${key}" must be a non-negative integer.`);
  }

  return value;
}

function requireScore(data: Record<string, unknown>, key: string): number {
  const value = data[key];

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new DailyTrainingParseError(`Field "${key}" must be a score from 0 to 100.`);
  }

  return Math.round(value);
}

function requireDateString(data: Record<string, unknown>, key: string): string {
  const value = requireString(data, key);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DailyTrainingParseError(`Field "${key}" must be YYYY-MM-DD.`);
  }

  return value;
}

function optionalBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  const value = data[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new DailyTrainingParseError(`Field "${key}" must be boolean when present.`);
  }

  return value;
}

function requireEnum<T extends readonly string[]>(
  data: Record<string, unknown>,
  key: string,
  allowed: T
): T[number] {
  const value = requireString(data, key);

  if (!allowed.includes(value)) {
    throw new DailyTrainingParseError(`Field "${key}" has an unsupported value.`);
  }

  return value;
}

function requireHttpUrl(data: Record<string, unknown>, key: string): string {
  const value = requireString(data, key);

  if (!isHttpUrl(value)) {
    throw new DailyTrainingParseError(`Field "${key}" must be a valid http(s) URL.`);
  }

  return value;
}

function optionalHttpUrl(data: Record<string, unknown>, key: string): string | undefined {
  const value = optionalString(data, key);

  if (!value) {
    return undefined;
  }

  if (!isHttpUrl(value)) {
    throw new DailyTrainingParseError(`Field "${key}" must be a valid http(s) URL when present.`);
  }

  return value;
}

function normalizeStep(value: string): TrainingStep {
  return validSteps.includes(value as TrainingStep) ? (value as TrainingStep) : "listening";
}

function toYoutubeEmbedUrl(url: string): string | undefined {
  const id = extractYoutubeId(url);

  return id ? `https://www.youtube.com/embed/${id}` : undefined;
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
