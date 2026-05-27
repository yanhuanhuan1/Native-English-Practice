import {
  DIFFICULTY_OPTIONS,
  TOPIC_OPTIONS,
  type Difficulty,
  type Scenario,
  type Topic
} from "@/types/scenario";
import type { ScoreResult } from "@/types/scoring";

export class ScoringParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringParseError";
  }
}

type ScoreKey =
  | "score"
  | "meaningAccuracy"
  | "grammar"
  | "naturalness"
  | "spokenStyle"
  | "toneFit";

const validTopics = TOPIC_OPTIONS.map((option) => option.value);
const validDifficulties = DIFFICULTY_OPTIONS.map((option) => option.value);

export function parseScoreResult(rawContent: string): ScoreResult {
  const data = parseStrictJsonObject(rawContent);

  return {
    score: requireScore(data, "score"),
    meaningAccuracy: requireScore(data, "meaningAccuracy"),
    grammar: requireScore(data, "grammar"),
    naturalness: requireScore(data, "naturalness"),
    spokenStyle: requireScore(data, "spokenStyle"),
    toneFit: requireScore(data, "toneFit"),
    feedbackZh: requireString(data, "feedbackZh"),
    betterAnswer: requireString(data, "betterAnswer"),
    alternatives: requireStringArray(data, "alternatives"),
    whyBetterZh: requireString(data, "whyBetterZh"),
    keyPhrases: requireStringArray(data, "keyPhrases")
  };
}

export function parseGeneratedScenario(
  rawContent: string
): Omit<Scenario, "id" | "source"> {
  const data = parseStrictJsonObject(rawContent);
  const topic = requireString(data, "topic");
  const difficulty = requireString(data, "difficulty");

  if (!validTopics.includes(topic as Topic)) {
    throw new ScoringParseError("Generated scenario used an unknown topic.");
  }

  if (!validDifficulties.includes(difficulty as Difficulty)) {
    throw new ScoringParseError(
      "Generated scenario used an unknown difficulty."
    );
  }

  const referenceAnswers = requireStringArray(data, "referenceAnswers");

  if (referenceAnswers.length === 0) {
    throw new ScoringParseError(
      "Generated scenario must include at least one reference answer."
    );
  }

  return {
    promptZh: requireString(data, "promptZh"),
    speaker: requireString(data, "speaker"),
    listener: requireString(data, "listener"),
    relationship: requireString(data, "relationship"),
    mood: requireString(data, "mood"),
    situation: requireString(data, "situation"),
    topic: topic as Topic,
    difficulty: difficulty as Difficulty,
    intent: requireString(data, "intent"),
    referenceAnswers,
    wordHints: optionalStringArray(data, "wordHints").slice(0, 2)
  };
}

function parseStrictJsonObject(rawContent: string): Record<string, unknown> {
  let data: unknown;

  try {
    data = JSON.parse(rawContent);
  } catch {
    throw new ScoringParseError(
      "AI returned malformed JSON. Please try again."
    );
  }

  if (!isRecord(data) || Array.isArray(data)) {
    throw new ScoringParseError("AI JSON response must be an object.");
  }

  return data;
}

function requireScore(
  data: Record<string, unknown>,
  key: ScoreKey
): number {
  const value = data[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ScoringParseError(`Field "${key}" must be a number.`);
  }

  if (value < 0 || value > 100) {
    throw new ScoringParseError(`Field "${key}" must be from 0 to 100.`);
  }

  return value;
}

function requireString(data: Record<string, unknown>, key: string): string {
  const value = data[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ScoringParseError(`Field "${key}" must be a non-empty string.`);
  }

  return value;
}

function requireStringArray(
  data: Record<string, unknown>,
  key: string
): string[] {
  const value = data[key];

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new ScoringParseError(
      `Field "${key}" must be an array of non-empty strings.`
    );
  }

  return value;
}

function optionalStringArray(
  data: Record<string, unknown>,
  key: string
): string[] {
  const value = data[key];

  if (value === undefined) {
    return [];
  }

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new ScoringParseError(
      `Field "${key}" must be an array of non-empty strings.`
    );
  }

  return value.map((item) => item.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
