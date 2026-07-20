import type {
  EnglishTrainingDay,
  FeedbackTask,
  ListeningTask,
  ReadingTask,
  SpeakingTask,
  TrainingLanguageChunk,
  TrainingLevel,
  TrainingPhase,
  TrainingResource,
  TrainingResourceType,
  TrainingVocabularyItem,
  WritingTask
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

const validResourceTypes: TrainingResourceType[] = ["listening", "reading"];

export function parseEnglishTrainingDay(rawContent: string): EnglishTrainingDay {
  const data = parseStrictJsonObject(rawContent);
  const level = requireEnum(data, "level", validLevels);
  const phase = requireEnum(data, "phase", validPhases);
  const dayNumber = requirePositiveInteger(data, "dayNumber");
  const resources = requireArray(data, "resources", parseResource);
  const listeningTask = parseListeningTask(requireRecord(data, "listeningTask"));
  const readingTask = parseReadingTask(requireRecord(data, "readingTask"));
  const vocabulary = requireArray(data, "vocabulary", parseVocabularyItem).slice(0, 10);
  const chunks = requireArray(data, "chunks", parseLanguageChunk).slice(0, 8);

  if (vocabulary.length < 5) {
    throw new DailyTrainingParseError("Training day must include at least 5 vocabulary items.");
  }

  if (chunks.length < 5) {
    throw new DailyTrainingParseError("Training day must include at least 5 language chunks.");
  }

  if (!resources.some((resource) => resource.type === "listening")) {
    throw new DailyTrainingParseError("Training day must include a listening resource.");
  }

  if (!resources.some((resource) => resource.type === "reading")) {
    throw new DailyTrainingParseError("Training day must include a reading resource.");
  }

  return {
    date: requireDateString(data, "date"),
    dayNumber,
    level,
    phase,
    topic: requireString(data, "topic"),
    resources,
    listeningTask,
    vocabulary,
    chunks,
    readingTask,
    speakingTask: parseSpeakingTask(requireRecord(data, "speakingTask")),
    writingTask: parseWritingTask(requireRecord(data, "writingTask"), dayNumber),
    feedbackTask: parseFeedbackTask(requireRecord(data, "feedbackTask")),
    completed: false
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

function parseResource(value: unknown): TrainingResource {
  const data = ensureRecord(value, "resource");
  const type = requireEnum(data, "type", validResourceTypes);
  const url = requireString(data, "url");

  if (!isHttpUrl(url)) {
    throw new DailyTrainingParseError("Resource url must be a valid http(s) URL.");
  }

  return {
    type,
    websiteName: requireString(data, "websiteName"),
    title: requireString(data, "title"),
    url,
    difficulty: requireString(data, "difficulty"),
    whySuitable: requireString(data, "whySuitable")
  };
}

function parseListeningTask(data: Record<string, unknown>): ListeningTask {
  const resource = parseResource(data.resource);

  if (resource.type !== "listening") {
    throw new DailyTrainingParseError("Listening task resource must have type listening.");
  }

  const firstListen = requireRecord(data, "firstListen");
  const secondListen = requireRecord(data, "secondListen");

  return {
    resource,
    firstListen: {
      instruction: requireString(firstListen, "instruction"),
      questions: requireStringArray(firstListen, "questions").slice(0, 5)
    },
    secondListen: {
      instruction: requireString(secondListen, "instruction"),
      extractionTarget: requireString(secondListen, "extractionTarget")
    }
  };
}

function parseReadingTask(data: Record<string, unknown>): ReadingTask {
  const resource = parseResource(data.resource);

  if (resource.type !== "reading") {
    throw new DailyTrainingParseError("Reading task resource must have type reading.");
  }

  return {
    resource,
    readingTarget: requireString(data, "readingTarget"),
    extractionInstruction: requireString(data, "extractionInstruction")
  };
}

function parseVocabularyItem(value: unknown): TrainingVocabularyItem {
  const data = ensureRecord(value, "vocabulary item");

  return {
    word: requireString(data, "word"),
    meaning: requireString(data, "meaning"),
    commonCollocations: requireStringArray(data, "commonCollocations").slice(0, 5),
    exampleSentence: requireString(data, "exampleSentence")
  };
}

function parseLanguageChunk(value: unknown): TrainingLanguageChunk {
  const data = ensureRecord(value, "language chunk");

  return {
    expression: requireString(data, "expression"),
    meaning: requireString(data, "meaning"),
    example: requireString(data, "example")
  };
}

function parseSpeakingTask(data: Record<string, unknown>): SpeakingTask {
  return {
    topic: requireString(data, "topic"),
    requirement: requireString(data, "requirement"),
    structure: requireStringArray(data, "structure"),
    simpleExpressionFrame: requireStringArray(data, "simpleExpressionFrame")
  };
}

function parseWritingTask(data: Record<string, unknown>, dayNumber: number): WritingTask {
  const enabled = requireBoolean(data, "enabled");
  const taskType = requireEnum(data, "taskType", [
    "none",
    "sentence",
    "paragraph",
    "ielts-task-2"
  ] as const);

  if (dayNumber <= 14 && (enabled || taskType !== "none")) {
    throw new DailyTrainingParseError("Writing must be disabled during the first two weeks.");
  }

  return {
    enabled,
    taskType,
    prompt: optionalString(data, "prompt"),
    bannedTemplates: requireStringArray(data, "bannedTemplates")
  };
}

function parseFeedbackTask(data: Record<string, unknown>): FeedbackTask {
  return {
    englishAnswerPrompt: requireString(data, "englishAnswerPrompt"),
    chunkSentencePrompt: requireString(data, "chunkSentencePrompt"),
    nextDayAdjustmentRule: requireString(data, "nextDayAdjustmentRule")
  };
}

function requireRecord(data: Record<string, unknown>, key: string): Record<string, unknown> {
  return ensureRecord(data[key], key);
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

  if (value === undefined || value === null) {
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

function requireDateString(data: Record<string, unknown>, key: string): string {
  const value = requireString(data, key);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DailyTrainingParseError(`Field "${key}" must be YYYY-MM-DD.`);
  }

  return value;
}

function requireBoolean(data: Record<string, unknown>, key: string): boolean {
  const value = data[key];

  if (typeof value !== "boolean") {
    throw new DailyTrainingParseError(`Field "${key}" must be boolean.`);
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
