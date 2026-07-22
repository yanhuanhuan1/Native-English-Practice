"use client";

import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mic,
  MoreHorizontal,
  Play,
  RotateCcw,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComprehensionQuestion,
  DailyTraining,
  DailyTrainingHistorySummary,
  DictationExercise,
  EnglishTrainingRecord,
  LearningItem,
  LearningItemMastery,
  ReviewItem,
  SpeakingFeedback,
  TranscriptSegment
} from "@/types/daily-training";
import {
  getLibraryLevelCount,
  normalizeLibraryLevel,
  pickDailyTrainingReserve,
  trainingLibraryLevels,
  type ExactTrainingLevel
} from "@/data/dailyTrainingVideoLibrary";

interface DailyTrainingApiResponse {
  training?: DailyTraining;
  error?: string;
}

interface SpeakingFeedbackApiResponse {
  feedback?: SpeakingFeedback;
  error?: string;
}

interface ServerConfigResponse {
  configured?: boolean;
}

const storageKey = "daily-english-training-records";
const levelStorageKey = "daily-english-training-level";

const masteryLabels: Record<LearningItemMastery, string> = {
  unknown: "不认识",
  fuzzy: "模糊",
  "known-passive": "认识但不会用",
  active: "可以主动使用"
};

type LessonStepId = "listening" | "expressions" | "practice" | "shadowing" | "speaking" | "review";
type LessonStepStatus = "not_started" | "in_progress" | "completed" | "needs_review";

interface LessonStep {
  id: LessonStepId;
  label: string;
  shortLabel: string;
  description: string;
  status: LessonStepStatus;
}

const stepStoragePrefix = "daily-english-training-current-step";

export function DailyEnglishTraining() {
  const [records, setRecords] = useState<EnglishTrainingRecord[]>([]);
  const [activeDate] = useState(() => getTodayKey());
  const [selectedLevel, setSelectedLevel] = useState<ExactTrainingLevel>("IELTS 5.0");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const generationRequestRef = useRef(0);

  useEffect(() => {
    setRecords(loadTrainingRecords());
    setSelectedLevel(loadSelectedLevel());

    let active = true;
    fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("config");
        }

        return (await response.json().catch(() => ({}))) as ServerConfigResponse;
      })
      .then((data) => {
        if (active) {
          setAiConfigured(!!data.configured);
        }
      })
      .catch(() => {
        if (active) {
          setAiConfigured(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const currentRecord =
    records.find((record) => record.training.date === activeDate) ?? null;
  const currentTraining = currentRecord?.training ?? null;
  const nextDayNumber = currentTraining?.dayNumber ?? getNextDayNumber(records);

  function handleLevelChange(level: ExactTrainingLevel) {
    setSelectedLevel(level);
    persistSelectedLevel(level);
  }

  async function handleGenerate(regenerate = false, level = selectedLevel) {
    if (aiConfigured === false) {
      setError("AI 服务尚未配置。请先在 Vercel 环境变量里设置 API_KEY。");
      return;
    }

    if (currentTraining && currentTraining.level === level && !regenerate) {
      return;
    }

    const historyRecords = records.filter((record) => record.training.date !== activeDate);
    const reserveItem = pickDailyTrainingReserve(
      level,
      records
        .map((record) => record.training.selectedReserveId)
        .filter((item): item is string => !!item),
      `${activeDate}-${level}-${Date.now()}-${Math.random()}`
    );

    setIsGenerating(true);
    setError(null);
    setMenuOpen(false);
    const requestId = generationRequestRef.current + 1;
    generationRequestRef.current = requestId;

    try {
      const response = await fetch("/api/daily-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: activeDate,
          dayNumber: nextDayNumber,
          level,
          reserveItem,
          historySummary: buildHistorySummary(historyRecords)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as DailyTrainingApiResponse;

      if (!response.ok || !payload.training) {
        throw new Error(payload.error ?? "生成失败，请稍后重试。");
      }

      if (requestId !== generationRequestRef.current) {
        return;
      }

      const nextRecords = upsertRecord(records, {
        training: prepareFreshTraining({
          ...payload.training,
          level,
          selectedReserveId: reserveItem.id
        }),
        completedSteps: []
      });
      persistRecords(nextRecords);
      setRecords(nextRecords);
    } catch (generateError) {
      if (requestId === generationRequestRef.current) {
        setError(generateError instanceof Error ? generateError.message : "生成失败，请稍后重试。");
      }
    } finally {
      if (requestId === generationRequestRef.current) {
        setIsGenerating(false);
      }
    }
  }

  function updateTraining(updater: (training: DailyTraining) => DailyTraining) {
    if (!currentTraining) {
      return;
    }

    const nextTraining = updater(currentTraining);
    const nextRecord: EnglishTrainingRecord = {
      ...(currentRecord ?? { completedSteps: [] }),
      training: nextTraining,
      completedSteps: nextTraining.completed
        ? ["listening", "expression", "practice", "speaking", "review"]
        : currentRecord?.completedSteps ?? [],
      completedAt: nextTraining.completed ? new Date().toISOString() : currentRecord?.completedAt
    };
    const nextRecords = upsertRecord(records, nextRecord);

    persistRecords(nextRecords);
    setRecords(nextRecords);
  }

  return (
    <main className="daily-lesson-page">
      <header className="daily-lesson-appbar">
        <Link className="daily-lesson-back" href="/">
          返回口语跟练
        </Link>
      </header>

      {!currentTraining ? (
        <EmptyLesson
          aiConfigured={aiConfigured}
          error={error}
          isGenerating={isGenerating}
          selectedLevel={selectedLevel}
          onGenerate={() => void handleGenerate(false, selectedLevel)}
          onLevelChange={handleLevelChange}
        />
      ) : (
        <LessonWorkspace
          key={getTrainingInstanceKey(currentTraining)}
          error={error}
          isGenerating={isGenerating}
          menuOpen={menuOpen}
          selectedLevel={selectedLevel}
          training={currentTraining}
          onLevelChange={handleLevelChange}
          onMenuToggle={() => setMenuOpen((open) => !open)}
          onRegenerate={() => void handleGenerate(true, selectedLevel)}
          onRefreshLevel={(level) => void handleGenerate(true, level)}
          onStartLevel={() => void handleGenerate(true, selectedLevel)}
          onUpdate={updateTraining}
        />
      )}
    </main>
  );
}

function LessonWorkspace({
  error,
  isGenerating,
  menuOpen,
  onLevelChange,
  onMenuToggle,
  onRegenerate,
  onRefreshLevel,
  onStartLevel,
  onUpdate,
  selectedLevel,
  training
}: {
  error: string | null;
  isGenerating: boolean;
  menuOpen: boolean;
  onLevelChange: (level: ExactTrainingLevel) => void;
  onMenuToggle: () => void;
  onRegenerate: () => void;
  onRefreshLevel: (level: ExactTrainingLevel) => void;
  onStartLevel: () => void;
  onUpdate: (updater: (training: DailyTraining) => DailyTraining) => void;
  selectedLevel: ExactTrainingLevel;
  training: DailyTraining;
}) {
  const trainingInstanceKey = getTrainingInstanceKey(training);
  const steps = useMemo(() => buildLessonSteps(training), [training]);
  const [currentStep, setCurrentStep] = useState<LessonStepId>(() =>
    getInitialLessonStep(training, steps)
  );
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const currentStepIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep));
  const activeStep = steps[currentStepIndex] ?? steps[0];
  const progress = steps.length
    ? Math.round((steps.filter((step) => step.status === "completed").length / steps.length) * 100)
    : getLessonProgress(training);

  useEffect(() => {
    if (steps.some((step) => step.id === currentStep)) {
      return;
    }

    setCurrentStep(steps[0]?.id ?? "listening");
  }, [currentStep, steps]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeStep) {
      return;
    }

    window.localStorage.setItem(getStepStorageKey(training), activeStep.id);
    const url = new URL(window.location.href);
    url.searchParams.set("step", activeStep.id);
    window.history.replaceState(window.history.state, "", url);
  }, [activeStep, training]);

  function goToStep(stepId: LessonStepId) {
    const nextStep = steps.find((step) => step.id === stepId);

    if (!nextStep) {
      return;
    }

    if (activeStep?.status !== "completed" && activeStep?.id !== stepId) {
      setStepNotice(`当前步骤「${activeStep?.label}」尚未完成，你仍然可以继续切换。`);
      window.setTimeout(() => setStepNotice(null), 2600);
    }

    setCurrentStep(stepId);
  }

  function goToRelativeStep(offset: -1 | 1) {
    const nextStep = steps[currentStepIndex + offset];

    if (nextStep) {
      goToStep(nextStep.id);
    }
  }

  function markStepComplete(stepId: LessonStepId) {
    onUpdate((draft) => markTrainingStepComplete(draft, stepId));
  }

  function completeStepAndContinue() {
    if (!activeStep) {
      return;
    }

    if (activeStep.id === "review") {
      completeLesson();
      return;
    }

    markStepComplete(activeStep.id);
    goToRelativeStep(1);
  }

  function completeLesson() {
    onUpdate((draft) => ({
      ...draft,
      completed: true,
      stepStatus: {
        listening: true,
        expression: true,
        practice: true,
        speaking: true,
        review: true
      },
      shadowing: {
        ...draft.shadowing,
        completed: true
      }
    }));

    window.setTimeout(() => {
      const shouldRefresh = window.confirm(
        `本课已完成。要随机刷新一套 ${training.level} 的新训练吗？`
      );

      if (shouldRefresh) {
        onRefreshLevel(normalizeLibraryLevel(training.level));
      }
    }, 0);
  }

  return (
    <section className={`daily-lesson-shell daily-lesson-shell-${activeStep?.id ?? "listening"}`}>
      <LessonHeader
        isGenerating={isGenerating}
        menuOpen={menuOpen}
        selectedLevel={selectedLevel}
        progress={progress}
        training={training}
        onLevelChange={onLevelChange}
        onMenuToggle={onMenuToggle}
        onRegenerate={onRegenerate}
        onStartLevel={onStartLevel}
      />
      {error ? <p className="daily-lesson-error">{error}</p> : null}
      <LessonStepper currentStep={activeStep?.id ?? "listening"} steps={steps} onStepChange={goToStep} />
      {stepNotice ? <p className="daily-lesson-step-notice">{stepNotice}</p> : null}

      <section className="daily-lesson-step-content">
        {activeStep?.id === "listening" ? (
          <ListeningStep
            key={`listening-${trainingInstanceKey}`}
            training={training}
          />
        ) : null}
        {activeStep?.id === "expressions" ? (
          <ExpressionsStep
            key={`expressions-${trainingInstanceKey}`}
            items={training.learningItems}
            onSpeakText={speakTrainingText}
            onUpdateItem={(itemId, updates) =>
              onUpdate((draft) => ({
                ...draft,
                learningItems: draft.learningItems.map((item) =>
                  item.id === itemId ? { ...item, ...updates } : item
                )
              }))
            }
          />
        ) : null}
        {activeStep?.id === "practice" ? (
          <PracticeStep
            key={`practice-${trainingInstanceKey}`}
            exercises={training.dictation}
            questions={training.comprehension}
            segments={training.transcriptSegments}
            onSpeakSegment={(segment) => speakTrainingText(segment.text)}
            onUpdateComprehension={(comprehension) =>
              onUpdate((draft) => ({ ...draft, comprehension }))
            }
            onUpdateDictation={(dictation) => onUpdate((draft) => ({ ...draft, dictation }))}
          />
        ) : null}
        {activeStep?.id === "shadowing" ? (
          <ShadowingStep
            key={`shadowing-${trainingInstanceKey}`}
            segments={training.transcriptSegments}
            shadowing={training.shadowing}
            onSpeakSegment={(segment) => speakTrainingText(segment.text)}
            onUpdate={(shadowing) => onUpdate((draft) => ({ ...draft, shadowing }))}
          />
        ) : null}
        {activeStep?.id === "speaking" ? (
          <OutputPanel
            key={`output-${trainingInstanceKey}`}
            learningItems={training.learningItems}
            outputTask={training.outputTask}
            topic={training.topic}
            onUpdate={(outputTask) => onUpdate((draft) => ({ ...draft, outputTask }))}
          />
        ) : null}
        {activeStep?.id === "review" ? (
          <CompleteLessonPanel
            key={`review-${trainingInstanceKey}`}
            review={training.lessonReview}
            completed={training.completed}
            onAddReview={() =>
              onUpdate((draft) => ({
                ...draft,
                lessonReview: { ...draft.lessonReview, addedToReview: true },
                review: mergeReviewItems(draft.review, draft.learningItems.slice(0, 3))
              }))
            }
            onComplete={completeLesson}
          />
        ) : null}
      </section>

      {activeStep ? (
        <StickyStepFooter
          currentIndex={currentStepIndex}
          currentStep={activeStep}
          steps={steps}
          onCompleteAndNext={completeStepAndContinue}
          onPrevious={() => goToRelativeStep(-1)}
        />
      ) : null}
    </section>
  );
}

function LessonHeader({
  isGenerating,
  menuOpen,
  onLevelChange,
  onMenuToggle,
  onRegenerate,
  onStartLevel,
  progress,
  selectedLevel,
  training
}: {
  isGenerating: boolean;
  menuOpen: boolean;
  onLevelChange: (level: ExactTrainingLevel) => void;
  onMenuToggle: () => void;
  onRegenerate: () => void;
  onStartLevel: () => void;
  progress: number;
  selectedLevel: ExactTrainingLevel;
  training: DailyTraining;
}) {
  const levelChanged = selectedLevel !== training.level;

  return (
    <header className="daily-lesson-header">
      <div>
        <span className="daily-lesson-kicker">Day {training.dayNumber}</span>
        <h1>{training.topic}</h1>
        <div className="daily-lesson-meta">
          <span>{training.listening.resource.level}</span>
          <span>{training.listening.resource.duration}</span>
          <span>{progress}% complete</span>
        </div>
      </div>
      <div className="daily-lesson-header-actions">
        <label className="daily-lesson-level-inline">
          <span>等级</span>
          <select
            value={selectedLevel}
            onChange={(event) => onLevelChange(event.target.value as ExactTrainingLevel)}
          >
            {trainingLibraryLevels.map((level) => (
              <option value={level} key={level}>
                {level} · {getLibraryLevelCount(level)} 条
              </option>
            ))}
          </select>
        </label>
        {levelChanged ? (
          <button
            className="daily-lesson-primary"
            disabled={isGenerating}
            type="button"
            onClick={onStartLevel}
          >
            {isGenerating ? <Loader2 className="daily-training-spin" size={16} /> : <Sparkles size={16} />}
            开始该等级
          </button>
        ) : null}
        <div className="daily-lesson-menu-wrap">
          <button className="daily-lesson-icon-btn" type="button" onClick={onMenuToggle}>
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className="daily-lesson-menu">
              <button disabled={isGenerating} type="button" onClick={onRegenerate}>
                {isGenerating ? <Loader2 className="daily-training-spin" size={16} /> : <RotateCcw size={16} />}
                重新抽取课程
              </button>
              <a href={training.listening.resource.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                查看原始资源
              </a>
              <Link href="/daily-training">返回训练记录</Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function LessonStepper({
  currentStep,
  onStepChange,
  steps
}: {
  currentStep: LessonStepId;
  onStepChange: (stepId: LessonStepId) => void;
  steps: LessonStep[];
}) {
  return (
    <nav className="daily-lesson-stepper" aria-label="每日训练步骤">
      {steps.map((step, index) => (
        <button
          className="daily-lesson-step-pill"
          data-active={step.id === currentStep}
          data-status={step.status}
          key={step.id}
          type="button"
          onClick={() => onStepChange(step.id)}
        >
          <span>{step.status === "completed" ? <CheckCircle2 size={15} /> : index + 1}</span>
          <strong>{step.shortLabel}</strong>
        </button>
      ))}
    </nav>
  );
}

function StickyStepFooter({
  currentIndex,
  currentStep,
  onCompleteAndNext,
  onPrevious,
  steps
}: {
  currentIndex: number;
  currentStep: LessonStep;
  onCompleteAndNext: () => void;
  onPrevious: () => void;
  steps: LessonStep[];
}) {
  const isLastStep = currentIndex >= steps.length - 1;
  const nextStep = steps[currentIndex + 1];

  return (
    <footer className="daily-lesson-sticky-footer">
      <button disabled={currentIndex === 0} type="button" onClick={onPrevious}>
        上一步
      </button>
      <div>
        <strong>{currentStep.label}</strong>
        <span>{getStepStatusLabel(currentStep.status)}</span>
      </div>
      <button className="daily-lesson-primary" type="button" onClick={onCompleteAndNext}>
        {isLastStep ? "完成今日训练" : `完成本步，进入${nextStep?.shortLabel ?? "下一步"}`}
      </button>
    </footer>
  );
}

function ListeningStep({
  training
}: {
  training: DailyTraining;
}) {
  return (
    <section className="daily-lesson-step-panel daily-lesson-listening-step">
      <div className="daily-lesson-video-block daily-lesson-video-block-large">
        <div className="daily-lesson-player">
          <EmbeddedPlayer resource={training.listening.resource} />
        </div>
        <div className="daily-lesson-resource-line">
          <strong>{training.listening.resource.title}</strong>
          <span>{training.listening.resource.source}</span>
          <span>{training.listening.resource.duration}</span>
          <span>{training.listening.resource.level}</span>
          <a href={training.listening.resource.url} target="_blank" rel="noreferrer" title="原始资源">
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
        <ListeningVocabularyStrip items={training.learningItems} />
      </div>
    </section>
  );
}

function ListeningVocabularyStrip({ items }: { items: LearningItem[] }) {
  const displayItems = items
    .filter((item) => item.type !== "pronunciation")
    .slice(0, 10);

  if (!displayItems.length) {
    return null;
  }

  return (
    <section className="daily-lesson-video-vocab">
      <div className="daily-lesson-section-head">
        <h2>本视频相关词汇和短语</h2>
        <span>简单释义</span>
      </div>
      <div className="daily-lesson-video-vocab-grid">
        {displayItems.map((item) => (
          <article key={item.id}>
            <strong>{item.text}</strong>
            <span>{item.meaning}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExpressionsStep({
  items,
  onSpeakText,
  onUpdateItem
}: {
  items: LearningItem[];
  onSpeakText: (text: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<LearningItem>) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [filter, setFilter] = useState<"all" | LearningItem["type"]>("all");
  const filteredItems = items.filter((item) => filter === "all" || item.type === filter);
  const activeItem = filteredItems[Math.min(activeIndex, Math.max(0, filteredItems.length - 1))];
  const upgrade = activeItem ? buildExpressionUpgrade(activeItem) : null;

  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  if (!activeItem || !upgrade) {
    return (
      <section className="daily-lesson-step-panel daily-lesson-narrow-step">
        <p className="daily-lesson-empty-note">本课没有可学习表达。可以继续进入下一步。</p>
      </section>
    );
  }

  return (
    <section className="daily-lesson-step-panel daily-lesson-narrow-step">
      <div className="daily-lesson-section-head">
        <h2>Expressions</h2>
        <span>{activeIndex + 1} / {filteredItems.length}</span>
      </div>
      <div className="daily-lesson-filter-row">
        {(["all", "expression", "vocabulary", "connectedSpeech", "pronunciation"] as const).map((item) => (
          <button
            aria-pressed={filter === item}
            key={item}
            type="button"
            onClick={() => setFilter(item)}
          >
            {item === "all" ? "全部" : getLearningTypeLabel(item)}
          </button>
        ))}
      </div>
      <article className="daily-lesson-learning-item daily-lesson-single-card">
        <div>
          <span>{getLearningTypeLabel(activeItem.type)}</span>
          <h3>{activeItem.text}</h3>
          <p>{activeItem.meaning}</p>
          <small>{activeItem.pronunciation}</small>
        </div>
        <p className="daily-lesson-source-sentence">视频原句：{activeItem.sourceSentence}</p>
        <div className="daily-lesson-chip-row">
          {activeItem.collocations.map((collocation) => (
            <span key={collocation}>{collocation}</span>
          ))}
        </div>
        <div className="daily-lesson-upgrade-chain">
          <div>
            <span>基础说法</span>
            <strong>{upgrade.simpleWord}</strong>
          </div>
          <div>
            <span>表达块</span>
            <strong>{upgrade.expressionBlock}</strong>
          </div>
          <div>
            <span>完整句</span>
            <strong>{upgrade.fullSentence}</strong>
          </div>
        </div>
        <div className="daily-lesson-learning-actions">
          <button type="button" onClick={() => onSpeakText(activeItem.sourceSentence)}>
            <Play size={15} />
            朗读原句
          </button>
          <button type="button" onClick={() => onSpeakText(upgrade.fullSentence)}>
            <Play size={15} />
            朗读完整句
          </button>
          <button type="button" onClick={() => onUpdateItem(activeItem.id, { saved: !activeItem.saved })}>
            {activeItem.saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            {activeItem.saved ? "已收藏" : "收藏"}
          </button>
          <select
            value={activeItem.mastery}
            onChange={(event) =>
              onUpdateItem(activeItem.id, { mastery: event.target.value as LearningItemMastery })
            }
          >
            {Object.entries(masteryLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="daily-lesson-card-pager">
          <button disabled={activeIndex === 0} type="button" onClick={() => setActiveIndex((value) => value - 1)}>
            上一条
          </button>
          <button
            disabled={activeIndex >= filteredItems.length - 1}
            type="button"
            onClick={() => setActiveIndex((value) => value + 1)}
          >
            下一条表达
          </button>
        </div>
      </article>
    </section>
  );
}

function EmbeddedPlayer({ resource }: { resource: DailyTraining["listening"]["resource"] }) {
  if (resource.playerType === "bilibili" && resource.embedUrl) {
    return (
      <iframe
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        scrolling="no"
        src={resource.embedUrl}
        title={resource.title}
      />
    );
  }

  if (resource.playerType === "youtube" && resource.embedUrl) {
    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        src={resource.embedUrl}
        title={resource.title}
      />
    );
  }

  if (resource.playerType === "audio" && resource.audioUrl) {
    return <audio controls src={resource.audioUrl} />;
  }

  return <iframe src={resource.url} title={resource.title} />;
}

type PracticeRunnerItem =
  | { kind: "dictation"; exercise: DictationExercise; index: number }
  | { kind: "comprehension"; question: ComprehensionQuestion; index: number };

function PracticeStep({
  exercises,
  onSpeakSegment,
  onUpdateComprehension,
  onUpdateDictation,
  questions,
  segments
}: {
  exercises: DictationExercise[];
  onSpeakSegment: (segment: TranscriptSegment) => void;
  onUpdateComprehension: (questions: ComprehensionQuestion[]) => void;
  onUpdateDictation: (exercises: DictationExercise[]) => void;
  questions: ComprehensionQuestion[];
  segments: TranscriptSegment[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items: PracticeRunnerItem[] = [
    ...exercises.map((exercise, index) => ({ kind: "dictation" as const, exercise, index })),
    ...questions.map((question, index) => ({ kind: "comprehension" as const, question, index }))
  ];
  const activeItem = items[Math.min(activeIndex, Math.max(0, items.length - 1))];

  if (!activeItem) {
    return (
      <section className="daily-lesson-step-panel daily-lesson-narrow-step">
        <p className="daily-lesson-empty-note">本课没有精听题。可以继续进入下一步。</p>
      </section>
    );
  }

  return (
    <section className="daily-lesson-step-panel daily-lesson-narrow-step">
      <div className="daily-lesson-section-head">
        <h2>Intensive Practice</h2>
        <span>Question {activeIndex + 1} / {items.length}</span>
      </div>
      {activeItem.kind === "dictation" ? (
        <SingleDictationExercise
          exercise={activeItem.exercise}
          exercises={exercises}
          segments={segments}
          onSpeakSegment={onSpeakSegment}
          onUpdate={onUpdateDictation}
        />
      ) : (
        <SingleComprehensionQuestion
          question={activeItem.question}
          questions={questions}
          onUpdate={onUpdateComprehension}
        />
      )}
      <div className="daily-lesson-card-pager">
        <button disabled={activeIndex === 0} type="button" onClick={() => setActiveIndex((value) => value - 1)}>
          上一题
        </button>
        <button
          disabled={activeIndex >= items.length - 1}
          type="button"
          onClick={() => setActiveIndex((value) => value + 1)}
        >
          下一题
        </button>
      </div>
    </section>
  );
}

function SingleDictationExercise({
  exercise,
  exercises,
  onSpeakSegment,
  onUpdate,
  segments
}: {
  exercise: DictationExercise;
  exercises: DictationExercise[];
  onSpeakSegment: (segment: TranscriptSegment) => void;
  onUpdate: (exercises: DictationExercise[]) => void;
  segments: TranscriptSegment[];
}) {
  const segment = segments.find((item) => item.id === exercise.segmentId);
  const diff = compareWords(exercise.userAnswer, exercise.correctText);

  function updateExercise(updates: Partial<DictationExercise>) {
    onUpdate(
      exercises.map((item) =>
        item.segmentId === exercise.segmentId ? { ...item, ...updates } : item
      )
    );
  }

  return (
    <article className="daily-lesson-dictation daily-lesson-single-card">
      <div className="daily-lesson-dictation-top">
        <strong>听写句子</strong>
        {segment ? (
          <button type="button" onClick={() => onSpeakSegment(segment)}>
            <Play size={15} />
            朗读原句
          </button>
        ) : null}
      </div>
      <textarea
        value={exercise.userAnswer}
        onChange={(event) =>
          updateExercise({
            userAnswer: event.target.value,
            completed: false
          })
        }
        placeholder="先听声音，再输入你听到的英文"
        rows={4}
      />
      <button
        className="daily-lesson-primary"
        type="button"
        onClick={() =>
          updateExercise({
            completed: true,
            missingWords: diff.missingWords,
            incorrectWords: diff.incorrectWords
          })
        }
      >
        提交答案
      </button>
      {exercise.completed ? (
        <div className="daily-lesson-diff">
          <p>
            正确：<strong>{exercise.correctText}</strong>
          </p>
          <p>你的答案：{exercise.userAnswer || "未填写"}</p>
          <p>漏词：{exercise.missingWords.join(" / ") || "无"}</p>
          <p>错词：{exercise.incorrectWords.join(" / ") || "无"}</p>
          {exercise.hint ? <p>提示：{exercise.hint}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function SingleComprehensionQuestion({
  onUpdate,
  question,
  questions
}: {
  onUpdate: (questions: ComprehensionQuestion[]) => void;
  question: ComprehensionQuestion;
  questions: ComprehensionQuestion[];
}) {
  function answerQuestion(answer: string) {
    onUpdate(
      questions.map((item) =>
        item.id === question.id ? { ...item, userAnswer: answer, completed: true } : item
      )
    );
  }

  return (
    <article className="daily-lesson-question-list daily-lesson-single-card">
      <h3>{question.question}</h3>
      <div className="daily-lesson-options">
        {question.options.map((option) => (
          <button
            data-selected={question.userAnswer === option}
            key={option}
            type="button"
            onClick={() => answerQuestion(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {question.completed ? (
        <p className="daily-lesson-answer">
          答案：{question.answer}。{question.explanation}
        </p>
      ) : null}
    </article>
  );
}

function ShadowingStep({
  onSpeakSegment,
  onUpdate,
  segments,
  shadowing
}: {
  onSpeakSegment: (segment: TranscriptSegment) => void;
  onUpdate: (shadowing: DailyTraining["shadowing"]) => void;
  segments: TranscriptSegment[];
  shadowing: DailyTraining["shadowing"];
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hideText, setHideText] = useState(false);
  const [recordingSegmentId, setRecordingSegmentId] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const selectedSegments = (shadowing.segmentIds.length
    ? shadowing.segmentIds
    : segments.slice(0, 5).map((segment) => segment.id)
  )
    .map((segmentId) => segments.find((segment) => segment.id === segmentId))
    .filter((segment): segment is TranscriptSegment => !!segment);
  const activeSegment = selectedSegments[Math.min(activeIndex, Math.max(0, selectedSegments.length - 1))];

  async function toggleRecording(segmentId: string) {
    if (recordingSegmentId === segmentId) {
      recorderRef.current?.stop();
      setRecordingSegmentId(null);
      return;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingError(null);
    } catch {
      setRecordingError("没有获得麦克风权限。可以朗读原句后自行跟读，或手动标记完成。");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunksRef.current, { type: "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
      onUpdate({
        ...shadowing,
        recordings: { ...shadowing.recordings, [segmentId]: url },
        completed: true
      });
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecordingSegmentId(segmentId);
  }

  if (!activeSegment) {
    return (
      <section className="daily-lesson-step-panel daily-lesson-narrow-step">
        <p className="daily-lesson-empty-note">本课没有可跟读句子。可以手动完成本步骤并继续。</p>
      </section>
    );
  }

  return (
    <section className="daily-lesson-step-panel daily-lesson-narrow-step">
      <div className="daily-lesson-section-head">
        <h2>Shadowing</h2>
        <span>Sentence {activeIndex + 1} / {selectedSegments.length}</span>
      </div>
      {recordingError ? <p className="daily-lesson-error">{recordingError}</p> : null}
      <article className="daily-lesson-shadowing-card">
        <span>{formatTime(activeSegment.startTime)}</span>
        <p>{hideText ? "文本已隐藏，先跟声音模仿。" : activeSegment.text}</p>
        {activeSegment.translation ? <small>{activeSegment.translation}</small> : null}
        <div className="daily-lesson-diff">
          <p>发音提示：注意句子重音、弱读和自然停顿。先模仿节奏，再追求完整。</p>
        </div>
        <div className="daily-lesson-learning-actions">
          <button type="button" onClick={() => onSpeakSegment(activeSegment)}>
            <Play size={15} />
            朗读原句
          </button>
          <button type="button" onClick={() => setHideText((value) => !value)}>
            {hideText ? "显示文本" : "隐藏文本"}
          </button>
          <button type="button" onClick={() => void toggleRecording(activeSegment.id)}>
            <Mic size={15} />
            {recordingSegmentId === activeSegment.id ? "停止录音" : "开始录音"}
          </button>
          {shadowing.recordings[activeSegment.id] ? (
            <audio controls src={shadowing.recordings[activeSegment.id]} />
          ) : null}
        </div>
        <div className="daily-lesson-card-pager">
          <button disabled={activeIndex === 0} type="button" onClick={() => setActiveIndex((value) => value - 1)}>
            上一句
          </button>
          <button
            disabled={activeIndex >= selectedSegments.length - 1}
            type="button"
            onClick={() => setActiveIndex((value) => value + 1)}
          >
            下一句
          </button>
        </div>
      </article>
    </section>
  );
}

function OutputPanel({
  learningItems,
  onUpdate,
  outputTask,
  topic
}: {
  learningItems: LearningItem[];
  onUpdate: (task: DailyTraining["outputTask"]) => void;
  outputTask: DailyTraining["outputTask"];
  topic: string;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const requiredItems = outputTask.requiredItemIds
    .map((itemId) => learningItems.find((item) => item.id === itemId))
    .filter((item): item is LearningItem => !!item);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingError(null);
    } catch {
      setRecordingError("没有获得麦克风权限。你也可以直接写下自己的口语转录。");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunksRef.current, { type: "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
      onUpdate({ ...outputTask, recordingUrl: url });
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  async function requestFeedback() {
    if (!outputTask.transcript?.trim()) {
      onUpdate({ ...outputTask, feedback: "请先写下或粘贴你的口语转录，再查看基础反馈。" });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/daily-training/speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: outputTask.transcript,
          question: outputTask.prompt,
          topic,
          expressions: requiredItems.map((item) => item.text)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as SpeakingFeedbackApiResponse;

      onUpdate({
        ...outputTask,
        feedback: payload.feedback?.suggestion ?? payload.error ?? "反馈生成失败，请稍后重试。",
        completed: true
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="daily-lesson-section">
      <div className="daily-lesson-section-head">
        <h2>当日输出任务</h2>
        <span>30-60 秒</span>
      </div>
      <div className="daily-lesson-output">
        <p>{outputTask.prompt}</p>
        <div className="daily-lesson-chip-row">
          {requiredItems.map((item) => (
            <span key={item.id}>{item.text}</span>
          ))}
        </div>
        {recordingError ? <p className="daily-lesson-error">{recordingError}</p> : null}
        <div className="daily-lesson-learning-actions">
          <button type="button" onClick={() => void toggleRecording()}>
            <Mic size={15} />
            {recording ? "停止录音" : "开始录音"}
          </button>
          {outputTask.recordingUrl ? <audio controls src={outputTask.recordingUrl} /> : null}
        </div>
        <textarea
          value={outputTask.transcript ?? ""}
          onChange={(event) => onUpdate({ ...outputTask, transcript: event.target.value })}
          placeholder="查看转录：可以手动写下你刚才说的内容"
          rows={4}
        />
        <button disabled={loading} type="button" onClick={() => void requestFeedback()}>
          {loading ? <Loader2 className="daily-training-spin" size={15} /> : <Sparkles size={15} />}
          查看基础反馈
        </button>
        {outputTask.feedback ? <p className="daily-lesson-answer">{outputTask.feedback}</p> : null}
      </div>
    </section>
  );
}

function CompleteLessonPanel({
  completed,
  onAddReview,
  onComplete,
  review
}: {
  completed: boolean;
  onAddReview: () => void;
  onComplete: () => void;
  review: DailyTraining["lessonReview"];
}) {
  return (
    <section className="daily-lesson-section daily-lesson-complete">
      <div className="daily-lesson-section-head">
        <h2>Today you learned</h2>
        {completed ? <span>已完成</span> : null}
      </div>
      <ul>
        <li>3 个重点表达：{review.expressions.join(" / ") || "完成学习项后生成"}</li>
        <li>2 个声音现象：{review.soundIssues.join(" / ") || "跟读时注意弱读和连读"}</li>
        <li>1 个复习句子：{review.reviewSentence}</li>
      </ul>
      <div className="daily-lesson-learning-actions">
        <button type="button" onClick={onAddReview}>
          {review.addedToReview ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {review.addedToReview ? "已加入复习" : "加入复习"}
        </button>
        <button className="daily-lesson-primary" disabled={completed} type="button" onClick={onComplete}>
          <CheckCircle2 size={15} />
          {completed ? "本课已完成" : "完成本课"}
        </button>
      </div>
    </section>
  );
}

function EmptyLesson({
  aiConfigured,
  error,
  isGenerating,
  onGenerate,
  onLevelChange,
  selectedLevel
}: {
  aiConfigured: boolean | null;
  error: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onLevelChange: (level: ExactTrainingLevel) => void;
  selectedLevel: ExactTrainingLevel;
}) {
  return (
    <section className="daily-lesson-empty">
      <span>Daily English Training</span>
      <h1>选择等级，开始今天的精听</h1>
      <p>每个等级内置 50 条 YouTube/官方媒体优先视频储备。开始后会抽取一条，并生成精听、表达提取、跟读和输出任务。</p>
      <div className="daily-lesson-level-grid">
        {trainingLibraryLevels.map((level) => (
          <button
            aria-pressed={selectedLevel === level}
            key={level}
            type="button"
            onClick={() => onLevelChange(level)}
          >
            <strong>{level}</strong>
            <span>{getLibraryLevelCount(level)} 条储备</span>
          </button>
        ))}
      </div>
      <button disabled={isGenerating || aiConfigured === false} type="button" onClick={onGenerate}>
        {isGenerating ? <Loader2 className="daily-training-spin" size={17} /> : <Sparkles size={17} />}
        从 {selectedLevel} 开始
      </button>
      {aiConfigured === false ? <p className="daily-lesson-error">AI 服务尚未配置 API_KEY。</p> : null}
      {error ? <p className="daily-lesson-error">{error}</p> : null}
    </section>
  );
}

function loadTrainingRecords(): EnglishTrainingRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsed = rawValue ? (JSON.parse(rawValue) as unknown) : [];

    return Array.isArray(parsed)
      ? parsed.filter(isTrainingRecord).map((record) => ({
          ...record,
          training: ensureTrainingDefaults(record.training),
          completedSteps: record.completedSteps ?? []
        }))
      : [];
  } catch {
    return [];
  }
}

function persistRecords(records: EnglishTrainingRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(records.slice(-180)));
}

function loadSelectedLevel(): ExactTrainingLevel {
  if (typeof window === "undefined") {
    return "IELTS 5.0";
  }

  const savedLevel = window.localStorage.getItem(levelStorageKey);

  return isExactTrainingLevel(savedLevel) ? savedLevel : "IELTS 5.0";
}

function persistSelectedLevel(level: ExactTrainingLevel) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(levelStorageKey, level);
}

function isExactTrainingLevel(value: unknown): value is ExactTrainingLevel {
  return typeof value === "string" && trainingLibraryLevels.includes(value as ExactTrainingLevel);
}

function upsertRecord(
  records: EnglishTrainingRecord[],
  nextRecord: EnglishTrainingRecord
): EnglishTrainingRecord[] {
  return [
    ...records.filter((record) => record.training.date !== nextRecord.training.date),
    nextRecord
  ].sort((left, right) => left.training.date.localeCompare(right.training.date));
}

function buildHistorySummary(records: EnglishTrainingRecord[]): DailyTrainingHistorySummary {
  const completedRecords = records.filter((record) => record.training.completed);
  const learningItems = records.flatMap((record) => record.training.learningItems ?? []);
  const reviewItems = records.flatMap((record) => record.training.review ?? []);
  const reviewedItems = reviewItems.filter((item) => typeof item.correct === "boolean");

  return {
    totalDays: records.length,
    completedDays: completedRecords.length,
    learnedExpressions: learningItems.length,
    reviewAccuracy: reviewedItems.length
      ? Math.round((reviewedItems.filter((item) => item.correct).length / reviewedItems.length) * 100)
      : 0,
    recentTopics: records.slice(-8).map((record) => record.training.topic),
    recentWeaknesses: [],
    dueReviewExpressions: reviewItems.map((item) => item.expression).slice(0, 12),
    recentFeedback: records
      .slice(-8)
      .map((record) => record.training.outputTask?.feedback)
      .filter((item): item is string => !!item)
  };
}

function ensureTrainingDefaults(training: DailyTraining): DailyTraining {
  const transcriptSegments = training.transcriptSegments ?? [];
  const learningItems = training.learningItems ?? [];

  return {
    ...training,
    activeStep: training.activeStep ?? "listening",
    stepStatus: {
      listening: !!training.stepStatus?.listening,
      expression: !!training.stepStatus?.expression,
      practice: !!training.stepStatus?.practice,
      speaking: !!training.stepStatus?.speaking,
      review: !!training.stepStatus?.review
    },
    transcriptSource: training.transcriptSource ?? (transcriptSegments.length ? "auto" : "unavailable"),
    transcriptSegments,
    learningItems,
    dictation: training.dictation ?? [],
    comprehension: training.comprehension ?? [],
    shadowing: training.shadowing ?? {
      segmentIds: transcriptSegments.slice(0, 3).map((segment) => segment.id),
      recordings: {},
      completed: false
    },
    outputTask: training.outputTask ?? {
      prompt: training.speaking?.question ?? "Use three expressions from this lesson.",
      requiredItemIds: learningItems.slice(0, 3).map((item) => item.id),
      completed: false
    },
    lessonReview: training.lessonReview ?? {
      expressions: learningItems.slice(0, 3).map((item) => item.text),
      soundIssues: [],
      reviewSentence: transcriptSegments[0]?.text ?? "",
      addedToReview: false
    },
    expressions: training.expressions ?? [],
    practice: training.practice ?? { fillBlank: [], replacements: [], sentenceBuilders: [] },
    review: training.review ?? [],
    weaknesses: training.weaknesses ?? { listening: [], expression: [], speaking: [], reading: [] },
    dashboard: training.dashboard ?? {
      totalDays: 0,
      learnedExpressions: 0,
      listeningMinutes: 0,
      speakingPracticeCount: 0,
      reviewAccuracy: 0
    }
  };
}

function prepareFreshTraining(training: DailyTraining): DailyTraining {
  const freshTraining = ensureTrainingDefaults(training);

  return {
    ...freshTraining,
    activeStep: "listening",
    stepStatus: {
      listening: false,
      expression: false,
      practice: false,
      speaking: false,
      review: false
    },
    transcriptSegments: freshTraining.transcriptSegments.map((segment) => ({
      ...segment,
      markedUnclear: false,
      completed: false
    })),
    learningItems: freshTraining.learningItems.map((item) => ({
      ...item,
      saved: false,
      mastery: "unknown"
    })),
    dictation: freshTraining.dictation.map((exercise) => ({
      ...exercise,
      userAnswer: "",
      missingWords: [],
      incorrectWords: [],
      completed: false
    })),
    comprehension: freshTraining.comprehension.map((question) => {
      const freshQuestion: ComprehensionQuestion = { ...question };
      delete freshQuestion.userAnswer;

      return {
        ...freshQuestion,
        completed: false
      };
    }),
    shadowing: {
      ...freshTraining.shadowing,
      recordings: {},
      completed: false
    },
    outputTask: {
      prompt: freshTraining.outputTask.prompt,
      requiredItemIds: freshTraining.outputTask.requiredItemIds,
      completed: false
    },
    lessonReview: {
      ...freshTraining.lessonReview,
      addedToReview: false
    },
    review: freshTraining.review.map((item) => {
      const freshItem: ReviewItem = { ...item };
      delete freshItem.userSentence;
      delete freshItem.correct;

      return freshItem;
    }),
    completed: false
  };
}

function isTrainingRecord(value: unknown): value is EnglishTrainingRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EnglishTrainingRecord>;
  const training = record.training as Partial<DailyTraining> | undefined;

  return !!(training?.date && training.dayNumber && training.listening);
}

function getNextDayNumber(records: EnglishTrainingRecord[]): number {
  return records.length ? Math.max(...records.map((record) => record.training.dayNumber)) + 1 : 1;
}

function buildLessonSteps(training: DailyTraining): LessonStep[] {
  const steps: LessonStep[] = [
    {
      id: "listening",
      label: "Listening",
      shortLabel: "听力",
      description: "视频输入和逐段文本",
      status: getListeningStatus(training)
    },
    {
      id: "expressions",
      label: "Expressions",
      shortLabel: "表达",
      description: "表达卡和高级表达拓展",
      status: getExpressionsStatus(training)
    }
  ];

  if (training.dictation.length || training.comprehension.length) {
    steps.push({
      id: "practice",
      label: "Intensive Practice",
      shortLabel: "精听",
      description: "听写和理解检查",
      status: getPracticeStatus(training)
    });
  }

  if (training.transcriptSegments.length || training.shadowing.segmentIds.length) {
    steps.push({
      id: "shadowing",
      label: "Shadowing",
      shortLabel: "跟读",
      description: "逐句模仿和录音",
      status: getShadowingStatus(training)
    });
  }

  steps.push(
    {
      id: "speaking",
      label: "Speaking",
      shortLabel: "口语",
      description: "一次综合输出任务",
      status: getSpeakingStatus(training)
    },
    {
      id: "review",
      label: "Review",
      shortLabel: "复盘",
      description: "加入复习并完成本课",
      status: training.completed ? "completed" : training.lessonReview.addedToReview ? "in_progress" : "not_started"
    }
  );

  return steps;
}

function getInitialLessonStep(training: DailyTraining, steps: LessonStep[]): LessonStepId {
  const availableStepIds = new Set(steps.map((step) => step.id));

  if (typeof window !== "undefined") {
    const urlStep = new URL(window.location.href).searchParams.get("step");
    if (isLessonStepId(urlStep) && availableStepIds.has(urlStep)) {
      return urlStep;
    }

    const storedStep = window.localStorage.getItem(getStepStorageKey(training));
    if (isLessonStepId(storedStep) && availableStepIds.has(storedStep)) {
      return storedStep;
    }
  }

  return steps.find((step) => step.status !== "completed")?.id ?? steps[0]?.id ?? "listening";
}

function getStepStorageKey(training: DailyTraining): string {
  return `${stepStoragePrefix}-${getTrainingInstanceKey(training)}`;
}

function isLessonStepId(value: unknown): value is LessonStepId {
  return (
    value === "listening" ||
    value === "expressions" ||
    value === "practice" ||
    value === "shadowing" ||
    value === "speaking" ||
    value === "review"
  );
}

function getListeningStatus(training: DailyTraining): LessonStepStatus {
  if (training.stepStatus.listening || training.transcriptSegments.some((segment) => segment.completed)) {
    return "completed";
  }

  return training.transcriptSegments.some((segment) => segment.markedUnclear) ? "needs_review" : "not_started";
}

function getExpressionsStatus(training: DailyTraining): LessonStepStatus {
  if (training.stepStatus.expression) {
    return "completed";
  }

  if (training.learningItems.every((item) => item.mastery !== "unknown") && training.learningItems.length) {
    return "completed";
  }

  return training.learningItems.some((item) => item.saved || item.mastery !== "unknown")
    ? "in_progress"
    : "not_started";
}

function getPracticeStatus(training: DailyTraining): LessonStepStatus {
  if (training.stepStatus.practice) {
    return "completed";
  }

  const total = training.dictation.length + training.comprehension.length;
  const completed =
    training.dictation.filter((exercise) => exercise.completed).length +
    training.comprehension.filter((question) => question.completed).length;

  if (total > 0 && completed >= total) {
    return "completed";
  }

  return completed > 0 ? "in_progress" : "not_started";
}

function getShadowingStatus(training: DailyTraining): LessonStepStatus {
  const recordingCount = Object.keys(training.shadowing.recordings).length;

  if (training.shadowing.completed || recordingCount >= Math.min(3, Math.max(1, training.shadowing.segmentIds.length))) {
    return "completed";
  }

  return recordingCount > 0 ? "in_progress" : "not_started";
}

function getSpeakingStatus(training: DailyTraining): LessonStepStatus {
  if (training.stepStatus.speaking || training.outputTask.completed) {
    return "completed";
  }

  return training.outputTask.recordingUrl || training.outputTask.transcript || training.outputTask.feedback
    ? "in_progress"
    : "not_started";
}

function markTrainingStepComplete(training: DailyTraining, stepId: LessonStepId): DailyTraining {
  switch (stepId) {
    case "listening":
      return { ...training, stepStatus: { ...training.stepStatus, listening: true } };
    case "expressions":
      return { ...training, stepStatus: { ...training.stepStatus, expression: true } };
    case "practice":
      return { ...training, stepStatus: { ...training.stepStatus, practice: true } };
    case "shadowing":
      return { ...training, shadowing: { ...training.shadowing, completed: true } };
    case "speaking":
      return {
        ...training,
        outputTask: { ...training.outputTask, completed: true },
        stepStatus: { ...training.stepStatus, speaking: true }
      };
    case "review":
      return { ...training, stepStatus: { ...training.stepStatus, review: true }, completed: true };
  }
}

function getStepStatusLabel(status: LessonStepStatus): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "in_progress":
      return "进行中";
    case "needs_review":
      return "需复习";
    case "not_started":
      return "未开始";
  }
}

function getLessonProgress(training: DailyTraining): number {
  const checks = [
    training.transcriptSegments.some((segment) => segment.markedUnclear || segment.completed),
    training.learningItems.some((item) => item.saved || item.mastery !== "unknown"),
    training.dictation.some((exercise) => exercise.completed),
    training.outputTask.completed || !!training.outputTask.feedback,
    training.completed
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getTrainingInstanceKey(training: DailyTraining): string {
  return [
    training.date,
    training.level,
    training.selectedReserveId,
    training.listening.resource.url,
    training.transcriptSegments.map((segment) => `${segment.id}:${segment.startTime}:${segment.endTime}`).join("|"),
    training.learningItems.map((item) => item.id).join("|")
  ]
    .filter(Boolean)
    .join("::");
}

function mergeReviewItems(review: ReviewItem[], items: LearningItem[]): ReviewItem[] {
  const nextItems = items.map((item) => ({
    expressionId: item.id,
    expression: item.text,
    meaning: item.meaning,
    dueDate: getTodayKey(),
    prompt: "用这个表达造一句自己的真实句子。"
  }));
  const existing = new Set(review.map((item) => item.expressionId));

  return [...review, ...nextItems.filter((item) => !existing.has(item.expressionId))];
}

function compareWords(userAnswer: string, correctText: string) {
  const userWords = normalizeWords(userAnswer);
  const correctWords = normalizeWords(correctText);
  const missingWords = correctWords.filter((word) => !userWords.includes(word));
  const incorrectWords = userWords.filter((word) => !correctWords.includes(word));

  return { missingWords, incorrectWords };
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildExpressionUpgrade(item: LearningItem) {
  const expressionBlock = item.collocations[0] || item.text;
  const fullSentence = item.reusableExample || item.sourceSentence || `I can use ${expressionBlock}.`;
  const simpleWord = pickSimpleExpressionSeed(item.text, item.sourceSentence, expressionBlock);

  return {
    id: item.id,
    simpleWord,
    expressionBlock,
    fullSentence,
    whyZh: `不要只停在 "${simpleWord}" 这种单点词汇，练成 "${expressionBlock}" 这样的表达块，开口时更容易直接组成自然的一句话。`
  };
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = String(safeSeconds % 60).padStart(2, "0");

  return `${minutes}:${rest}`;
}

function pickSimpleExpressionSeed(...values: string[]): string {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "your",
    "you",
    "are",
    "can",
    "use",
    "have",
    "from",
    "into",
    "about"
  ]);

  for (const value of values) {
    const word = value
      .split(/\s+/)
      .map((item) => item.replace(/[^a-zA-Z']/g, "").toLowerCase())
      .find((item) => item.length >= 4 && !stopWords.has(item));

    if (word) {
      return word;
    }
  }

  return values[0]?.split(/\s+/)[0] || "word";
}

function speakTrainingText(text: string) {
  if (typeof window === "undefined") {
    return;
  }

  const value = text.trim();

  if (!value) {
    return;
  }

  if (!window.speechSynthesis) {
    globalThis.alert("当前浏览器不支持朗读。");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1;

  const englishVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => /^en(-|_)/i.test(voice.lang));

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function getLearningTypeLabel(type: LearningItem["type"]): string {
  switch (type) {
    case "vocabulary":
      return "词汇";
    case "expression":
      return "表达";
    case "pronunciation":
      return "发音";
    case "connectedSpeech":
      return "连读";
  }
}

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}
