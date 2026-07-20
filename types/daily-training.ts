export type TrainingPhase = "phase1-foundation" | "phase2-bridge" | "phase3-ielts7";

export type TrainingLevel = "IELTS 5.0-6.0" | "IELTS 6.0-6.5" | "IELTS 7+";

export type TrainingResourceType = "listening" | "reading";

export interface TrainingResource {
  type: TrainingResourceType;
  websiteName: string;
  title: string;
  url: string;
  difficulty: string;
  whySuitable: string;
}

export interface TrainingVocabularyItem {
  word: string;
  meaning: string;
  commonCollocations: string[];
  exampleSentence: string;
}

export interface TrainingLanguageChunk {
  expression: string;
  meaning: string;
  example: string;
}

export interface ListeningTask {
  resource: TrainingResource;
  firstListen: {
    instruction: string;
    questions: string[];
  };
  secondListen: {
    instruction: string;
    extractionTarget: string;
  };
}

export interface ReadingTask {
  resource: TrainingResource;
  readingTarget: string;
  extractionInstruction: string;
}

export interface SpeakingTask {
  topic: string;
  requirement: string;
  structure: string[];
  simpleExpressionFrame: string[];
}

export interface WritingTask {
  enabled: boolean;
  taskType: "none" | "sentence" | "paragraph" | "ielts-task-2";
  prompt?: string;
  bannedTemplates: string[];
}

export interface FeedbackTask {
  englishAnswerPrompt: string;
  chunkSentencePrompt: string;
  nextDayAdjustmentRule: string;
}

export interface EnglishTrainingDay {
  date: string;
  dayNumber: number;
  level: TrainingLevel;
  phase: TrainingPhase;
  topic: string;
  resources: TrainingResource[];
  listeningTask: ListeningTask;
  vocabulary: TrainingVocabularyItem[];
  chunks: TrainingLanguageChunk[];
  readingTask: ReadingTask;
  speakingTask: SpeakingTask;
  writingTask: WritingTask;
  feedbackTask: FeedbackTask;
  completed: boolean;
}

export interface EnglishTrainingUserFeedback {
  englishAnswer: string;
  chunkSentence: string;
  note?: string;
  submittedAt: string;
}

export interface EnglishTrainingRecord {
  training: EnglishTrainingDay;
  feedback?: EnglishTrainingUserFeedback;
  completedAt?: string;
}

export interface DailyTrainingHistorySummary {
  totalDays: number;
  completedDays: number;
  recentTopics: string[];
  recentFeedback: string[];
}
