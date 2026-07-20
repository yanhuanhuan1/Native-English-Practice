export type TrainingPhase = "phase1-foundation" | "phase2-bridge" | "phase3-ielts7";

export type TrainingLevel = "IELTS 5.0-6.0" | "IELTS 6.0-6.5" | "IELTS 7+";

export type TrainingStep =
  | "listening"
  | "expression"
  | "practice"
  | "speaking"
  | "review";

export type StepStatus = Record<TrainingStep, boolean>;

export type ListeningPlayerType = "youtube" | "audio" | "web";

export type ExpressionMastery = "new" | "learning" | "mastered";

export interface ListeningResource {
  title: string;
  source: string;
  url: string;
  embedUrl?: string;
  audioUrl?: string;
  level: string;
  duration: string;
  playerType: ListeningPlayerType;
  whySuitable: string;
}

export interface ListeningTask {
  resource: ListeningResource;
  firstListen: {
    instruction: string;
    questions: string[];
  };
  secondListen: {
    instruction: string;
    task: string;
  };
  transcript?: string;
}

export interface TrainingExpression {
  id: string;
  expression: string;
  meaning: string;
  example: string;
  scenario: string;
  pronunciation: string;
  difficulty: string;
  favorite: boolean;
  reviewDate: string;
  mastery: ExpressionMastery;
}

export interface FillBlankPractice {
  id: string;
  prompt: string;
  answer: string;
  hint?: string;
}

export interface ReplacementPractice {
  id: string;
  baseSentence: string;
  targetWord: string;
  replacements: string[];
  modelAnswer: string;
}

export interface SentenceBuilderPractice {
  id: string;
  keywords: string[];
  modelAnswer: string;
  context: string;
}

export interface PracticeModule {
  fillBlank: FillBlankPractice[];
  replacements: ReplacementPractice[];
  sentenceBuilders: SentenceBuilderPractice[];
}

export interface SpeakingFeedback {
  fluency: number;
  grammar: number;
  vocabulary: number;
  naturalness: number;
  suggestion: string;
  betterVersion: string;
}

export interface SpeakingPractice {
  question: string;
  answer?: string;
  feedback?: SpeakingFeedback;
}

export interface ReadingHighlight {
  expression: string;
  meaning: string;
  example: string;
}

export interface ReadingCard {
  title: string;
  source: string;
  url: string;
  level: string;
  text: string;
  zhAssist: string;
  highlightedExpressions: ReadingHighlight[];
}

export interface ReviewItem {
  expressionId: string;
  expression: string;
  meaning: string;
  dueDate: string;
  prompt: string;
  userSentence?: string;
  correct?: boolean;
}

export interface WeaknessTracking {
  listening: string[];
  expression: string[];
  speaking: string[];
  reading: string[];
}

export interface ProgressDashboard {
  totalDays: number;
  learnedExpressions: number;
  listeningMinutes: number;
  speakingPracticeCount: number;
  reviewAccuracy: number;
}

export interface DailyTraining {
  date: string;
  dayNumber: number;
  level: TrainingLevel;
  phase: TrainingPhase;
  topic: string;
  activeStep: TrainingStep;
  stepStatus: StepStatus;
  listening: ListeningTask;
  expressions: TrainingExpression[];
  practice: PracticeModule;
  speaking: SpeakingPractice;
  reading: ReadingCard;
  review: ReviewItem[];
  weaknesses: WeaknessTracking;
  dashboard: ProgressDashboard;
  completed: boolean;
}

export interface EnglishTrainingUserFeedback {
  speakingAnswer?: string;
  reviewSentences: string[];
  practiceNotes?: string;
  submittedAt: string;
}

export interface EnglishTrainingRecord {
  training: DailyTraining;
  feedback?: EnglishTrainingUserFeedback;
  completedSteps: TrainingStep[];
  completedAt?: string;
}

export interface DailyTrainingHistorySummary {
  totalDays: number;
  completedDays: number;
  learnedExpressions: number;
  reviewAccuracy: number;
  recentTopics: string[];
  recentWeaknesses: string[];
  dueReviewExpressions: string[];
  recentFeedback: string[];
}
