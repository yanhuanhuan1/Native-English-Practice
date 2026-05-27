import type { Difficulty, Topic } from "@/types/scenario";

export interface ScoreResult {
  score: number;
  meaningAccuracy: number;
  grammar: number;
  naturalness: number;
  spokenStyle: number;
  toneFit: number;
  feedbackZh: string;
  betterAnswer: string;
  alternatives: string[];
  whyBetterZh: string;
  keyPhrases: string[];
}

export interface Attempt {
  id: string;
  scenarioId: string;
  scenarioPromptZh: string;
  topic: Topic;
  difficulty: Difficulty;
  userAnswer: string;
  result: ScoreResult;
  createdAt: string;
}

export interface InsightReport {
  generatedAt: string;
  attemptCount: number;
  weaknesses: string[];
  vocabularyIssues: string[];
  analysis: string;
  improvement?: string;
}

export interface InsightState {
  totalAttempts: number;
  reports: InsightReport[];
}
