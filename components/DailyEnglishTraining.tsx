"use client";

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Headphones,
  History,
  Loader2,
  Mic2,
  RotateCcw,
  Send,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  DailyTrainingHistorySummary,
  EnglishTrainingDay,
  EnglishTrainingRecord,
  EnglishTrainingUserFeedback,
  TrainingLanguageChunk,
  TrainingResource,
  TrainingVocabularyItem
} from "@/types/daily-training";

interface DailyTrainingApiResponse {
  training?: EnglishTrainingDay;
  error?: string;
}

interface ServerConfigResponse {
  configured?: boolean;
}

const storageKey = "daily-english-training-records";

export function DailyEnglishTraining() {
  const [records, setRecords] = useState<EnglishTrainingRecord[]>([]);
  const [activeDate, setActiveDate] = useState(() => getTodayKey());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [englishAnswer, setEnglishAnswer] = useState("");
  const [chunkSentence, setChunkSentence] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setRecords(loadTrainingRecords());

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

  const sortedRecords = useMemo(
    () =>
      [...records].sort((left, right) =>
        right.training.date.localeCompare(left.training.date)
      ),
    [records]
  );
  const currentRecord =
    records.find((record) => record.training.date === activeDate) ?? null;
  const currentTraining = currentRecord?.training ?? null;
  const nextDayNumber = currentTraining?.dayNumber ?? getNextDayNumber(records);
  const progress = getProgress(records);

  useEffect(() => {
    if (!currentRecord?.feedback) {
      setEnglishAnswer("");
      setChunkSentence("");
      setNote("");
      return;
    }

    setEnglishAnswer(currentRecord.feedback.englishAnswer);
    setChunkSentence(currentRecord.feedback.chunkSentence);
    setNote(currentRecord.feedback.note ?? "");
  }, [currentRecord?.training.date, currentRecord?.feedback]);

  async function handleGenerate(regenerate = false) {
    if (aiConfigured === false) {
      setError("AI 服务尚未配置，请先在 Vercel 环境变量中设置 API_KEY。");
      return;
    }

    if (currentTraining && !regenerate) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/daily-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: activeDate,
          dayNumber: nextDayNumber,
          historySummary: buildHistorySummary(records)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | DailyTrainingApiResponse
        | Record<string, never>;

      if (!response.ok || !("training" in payload) || !payload.training) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "生成失败，请稍后重试。"
        );
      }

      const nextRecords = upsertRecord(records, {
        training: payload.training
      });
      persistRecords(nextRecords);
      setRecords(nextRecords);
      setEnglishAnswer("");
      setChunkSentence("");
      setNote("");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "生成失败，请稍后重试。"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSaveFeedback() {
    if (!currentTraining) {
      return;
    }

    const feedback: EnglishTrainingUserFeedback = {
      englishAnswer: englishAnswer.trim(),
      chunkSentence: chunkSentence.trim(),
      note: note.trim() || undefined,
      submittedAt: new Date().toISOString()
    };
    const nextRecord: EnglishTrainingRecord = {
      training: {
        ...currentTraining,
        completed: true
      },
      feedback,
      completedAt: new Date().toISOString()
    };
    const nextRecords = upsertRecord(records, nextRecord);

    persistRecords(nextRecords);
    setRecords(nextRecords);
  }

  return (
    <main className="daily-training-page">
      <header className="daily-training-topbar">
        <div>
          <span className="daily-training-kicker">Daily English Training</span>
          <h1>每日英语训练</h1>
        </div>
        <Link className="daily-training-link" href="/">
          返回口语跟练
        </Link>
      </header>

      <section className="daily-training-shell">
        <aside className="daily-training-sidebar">
          <div className="daily-training-card">
            <div className="daily-training-card-head">
              <CalendarDays size={18} aria-hidden="true" />
              <h2>训练日期</h2>
            </div>
            <input
              aria-label="训练日期"
              type="date"
              value={activeDate}
              onChange={(event) => setActiveDate(event.target.value)}
            />
            <button
              className="daily-training-primary"
              disabled={isGenerating || aiConfigured === false || !!currentTraining}
              type="button"
              onClick={() => void handleGenerate(false)}
            >
              {isGenerating ? (
                <Loader2 className="daily-training-spin" size={17} aria-hidden="true" />
              ) : (
                <Sparkles size={17} aria-hidden="true" />
              )}
              {currentTraining ? "今日已生成" : "生成今日训练"}
            </button>
            {currentTraining ? (
              <button
                className="daily-training-ghost"
                disabled={isGenerating || aiConfigured === false}
                type="button"
                onClick={() => void handleGenerate(true)}
              >
                <RotateCcw size={16} aria-hidden="true" />
                重新生成
              </button>
            ) : null}
            {aiConfigured === false ? (
              <p className="daily-training-error">
                AI 服务尚未配置。上线版本需要在 Vercel 环境变量里配置 API_KEY。
              </p>
            ) : null}
            {error ? <p className="daily-training-error">{error}</p> : null}
          </div>

          <div className="daily-training-card">
            <div className="daily-training-card-head">
              <CheckCircle2 size={18} aria-hidden="true" />
              <h2>完成进度</h2>
            </div>
            <div className="daily-training-stat-grid">
              <Stat label="累计训练" value={`${progress.total} 天`} />
              <Stat label="已完成" value={`${progress.completed} 天`} />
              <Stat label="完成率" value={`${progress.rate}%`} />
            </div>
          </div>

          <div className="daily-training-card">
            <div className="daily-training-card-head">
              <History size={18} aria-hidden="true" />
              <h2>历史记录</h2>
            </div>
            {sortedRecords.length === 0 ? (
              <p className="daily-training-muted">还没有训练记录。</p>
            ) : (
              <div className="daily-training-history-list">
                {sortedRecords.map((record) => (
                  <button
                    aria-pressed={record.training.date === activeDate}
                    className="daily-training-history-item"
                    key={record.training.date}
                    type="button"
                    onClick={() => setActiveDate(record.training.date)}
                  >
                    <strong>Day {record.training.dayNumber}</strong>
                    <span>{record.training.topic}</span>
                    <small>
                      {record.training.date}
                      {record.training.completed ? " · 已完成" : ""}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="daily-training-main">
          {!currentTraining ? (
            <EmptyTrainingState
              isGenerating={isGenerating}
              onGenerate={() => void handleGenerate(false)}
            />
          ) : (
            <>
              <TrainingHeader training={currentTraining} />
              <ListeningModule training={currentTraining} />
              <VocabularyModule vocabulary={currentTraining.vocabulary} />
              <ChunksModule chunks={currentTraining.chunks} />
              <ReadingModule training={currentTraining} />
              <SpeakingModule training={currentTraining} />
              <WritingNotice training={currentTraining} />
              <FeedbackModule
                completed={currentTraining.completed}
                englishAnswer={englishAnswer}
                chunkSentence={chunkSentence}
                note={note}
                training={currentTraining}
                onEnglishAnswerChange={setEnglishAnswer}
                onChunkSentenceChange={setChunkSentence}
                onNoteChange={setNote}
                onSave={handleSaveFeedback}
              />
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function TrainingHeader({ training }: { training: EnglishTrainingDay }) {
  return (
    <section className="daily-training-hero">
      <span>Day {training.dayNumber} English Training</span>
      <h2>{training.topic}</h2>
      <div className="daily-training-badges">
        <span>{training.level}</span>
        <span>{getPhaseLabel(training.phase)}</span>
        <span>{training.date}</span>
        {training.completed ? <span>已完成</span> : null}
      </div>
    </section>
  );
}

function ListeningModule({ training }: { training: EnglishTrainingDay }) {
  return (
    <TrainingSection
      icon={<Headphones size={18} aria-hidden="true" />}
      eyebrow="1. Listening Module"
      title="听力输入"
    >
      <ResourceBlock resource={training.listeningTask.resource} />
      <div className="daily-training-two-col">
        <TaskBlock title="第一次：不开字幕">
          <p>{training.listeningTask.firstListen.instruction}</p>
          <ul>
            {training.listeningTask.firstListen.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </TaskBlock>
        <TaskBlock title="第二次：打开英文字幕">
          <p>{training.listeningTask.secondListen.instruction}</p>
          <p>{training.listeningTask.secondListen.extractionTarget}</p>
        </TaskBlock>
      </div>
    </TrainingSection>
  );
}

function VocabularyModule({ vocabulary }: { vocabulary: TrainingVocabularyItem[] }) {
  return (
    <TrainingSection
      icon={<BookOpen size={18} aria-hidden="true" />}
      eyebrow="2. Vocabulary Module"
      title="核心词汇"
    >
      <div className="daily-training-list-grid">
        {vocabulary.map((item) => (
          <article className="daily-training-mini-card" key={item.word}>
            <h4>{item.word}</h4>
            <p>{item.meaning}</p>
            <div className="daily-training-chip-row">
              {item.commonCollocations.map((collocation) => (
                <span key={collocation}>{collocation}</span>
              ))}
            </div>
            <q>{item.exampleSentence}</q>
          </article>
        ))}
      </div>
    </TrainingSection>
  );
}

function ChunksModule({ chunks }: { chunks: TrainingLanguageChunk[] }) {
  return (
    <TrainingSection
      icon={<Sparkles size={18} aria-hidden="true" />}
      eyebrow="3. Language Chunk Module"
      title="语言块"
    >
      <div className="daily-training-list-grid">
        {chunks.map((chunk) => (
          <article className="daily-training-mini-card" key={chunk.expression}>
            <h4>{chunk.expression}</h4>
            <p>{chunk.meaning}</p>
            <q>{chunk.example}</q>
          </article>
        ))}
      </div>
    </TrainingSection>
  );
}

function ReadingModule({ training }: { training: EnglishTrainingDay }) {
  return (
    <TrainingSection
      icon={<BookOpen size={18} aria-hidden="true" />}
      eyebrow="4. Reading Module"
      title="阅读输入"
    >
      <ResourceBlock resource={training.readingTask.resource} />
      <TaskBlock title="阅读目标">
        <p>{training.readingTask.readingTarget}</p>
        <p>{training.readingTask.extractionInstruction}</p>
      </TaskBlock>
    </TrainingSection>
  );
}

function SpeakingModule({ training }: { training: EnglishTrainingDay }) {
  return (
    <TrainingSection
      icon={<Mic2 size={18} aria-hidden="true" />}
      eyebrow="5. Speaking Module"
      title="口语输出"
    >
      <TaskBlock title={training.speakingTask.topic}>
        <p>{training.speakingTask.requirement}</p>
        <div className="daily-training-two-col">
          <div>
            <h4>结构</h4>
            <ol>
              {training.speakingTask.structure.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4>简单表达框架</h4>
            <ul>
              {training.speakingTask.simpleExpressionFrame.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </TaskBlock>
    </TrainingSection>
  );
}

function WritingNotice({ training }: { training: EnglishTrainingDay }) {
  return (
    <TrainingSection
      icon={<BookOpen size={18} aria-hidden="true" />}
      eyebrow="Writing Rule"
      title="写作训练"
    >
      {training.writingTask.enabled ? (
        <TaskBlock title={training.writingTask.taskType}>
          <p>{training.writingTask.prompt}</p>
          <p className="daily-training-muted">
            不使用模板：{training.writingTask.bannedTemplates.join(" / ")}
          </p>
        </TaskBlock>
      ) : (
        <p className="daily-training-muted">
          前两周关闭写作训练，先建立词汇、语言块、听力和口语输出库存。
        </p>
      )}
    </TrainingSection>
  );
}

function FeedbackModule({
  completed,
  englishAnswer,
  chunkSentence,
  note,
  training,
  onEnglishAnswerChange,
  onChunkSentenceChange,
  onNoteChange,
  onSave
}: {
  completed: boolean;
  englishAnswer: string;
  chunkSentence: string;
  note: string;
  training: EnglishTrainingDay;
  onEnglishAnswerChange: (value: string) => void;
  onChunkSentenceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
}) {
  const canSave = englishAnswer.trim().length > 0 && chunkSentence.trim().length > 0;

  return (
    <TrainingSection
      icon={<Send size={18} aria-hidden="true" />}
      eyebrow="6. User Feedback"
      title="提交今日反馈"
    >
      <div className="daily-training-form">
        <label>
          <span>{training.feedbackTask.englishAnswerPrompt}</span>
          <textarea
            value={englishAnswer}
            onChange={(event) => onEnglishAnswerChange(event.target.value)}
            rows={4}
          />
        </label>
        <label>
          <span>{training.feedbackTask.chunkSentencePrompt}</span>
          <textarea
            value={chunkSentence}
            onChange={(event) => onChunkSentenceChange(event.target.value)}
            rows={3}
          />
        </label>
        <label>
          <span>今天哪里觉得难？</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
          />
        </label>
        <p className="daily-training-muted">
          {training.feedbackTask.nextDayAdjustmentRule}
        </p>
        <button
          className="daily-training-primary"
          disabled={!canSave}
          type="button"
          onClick={onSave}
        >
          <CheckCircle2 size={17} aria-hidden="true" />
          {completed ? "更新完成记录" : "标记今日完成"}
        </button>
      </div>
    </TrainingSection>
  );
}

function TrainingSection({
  children,
  eyebrow,
  icon,
  title
}: {
  children: React.ReactNode;
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="daily-training-section">
      <div className="daily-training-section-head">
        <span>{icon}</span>
        <div>
          <small>{eyebrow}</small>
          <h3>{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function ResourceBlock({ resource }: { resource: TrainingResource }) {
  return (
    <article className="daily-training-resource">
      <div>
        <span>{resource.websiteName}</span>
        <h4>{resource.title}</h4>
        <p>{resource.whySuitable}</p>
      </div>
      <div className="daily-training-resource-side">
        <span>{resource.difficulty}</span>
        <a href={resource.url} target="_blank" rel="noreferrer">
          打开资源
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function TaskBlock({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <article className="daily-training-task">
      <h4>{title}</h4>
      {children}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="daily-training-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyTrainingState({
  isGenerating,
  onGenerate
}: {
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <section className="daily-training-empty">
      <span>Daily English Training</span>
      <h2>为今天生成一套输入到输出的训练</h2>
      <p>
        系统会通过 AI agent 搜索真实资源，再为当前阶段设计听力、词汇、语言块、阅读和口语任务。
      </p>
      <button
        className="daily-training-primary"
        disabled={isGenerating}
        type="button"
        onClick={onGenerate}
      >
        {isGenerating ? (
          <Loader2 className="daily-training-spin" size={17} aria-hidden="true" />
        ) : (
          <Sparkles size={17} aria-hidden="true" />
        )}
        生成今日训练
      </button>
    </section>
  );
}

function loadTrainingRecords(): EnglishTrainingRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    return rawValue ? (JSON.parse(rawValue) as EnglishTrainingRecord[]) : [];
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

function upsertRecord(
  records: EnglishTrainingRecord[],
  nextRecord: EnglishTrainingRecord
): EnglishTrainingRecord[] {
  const next = records.filter(
    (record) => record.training.date !== nextRecord.training.date
  );

  return [...next, nextRecord].sort((left, right) =>
    left.training.date.localeCompare(right.training.date)
  );
}

function buildHistorySummary(records: EnglishTrainingRecord[]): DailyTrainingHistorySummary {
  const completedRecords = records.filter((record) => record.training.completed);
  const recentRecords = [...records]
    .sort((left, right) => right.training.date.localeCompare(left.training.date))
    .slice(0, 8);

  return {
    totalDays: records.length,
    completedDays: completedRecords.length,
    recentTopics: recentRecords.map((record) => record.training.topic),
    recentFeedback: recentRecords
      .map((record) =>
        [record.feedback?.englishAnswer, record.feedback?.chunkSentence, record.feedback?.note]
          .filter(Boolean)
          .join(" | ")
      )
      .filter((value) => value.trim().length > 0)
  };
}

function getNextDayNumber(records: EnglishTrainingRecord[]): number {
  if (records.length === 0) {
    return 1;
  }

  return Math.max(...records.map((record) => record.training.dayNumber)) + 1;
}

function getProgress(records: EnglishTrainingRecord[]) {
  const total = records.length;
  const completed = records.filter((record) => record.training.completed).length;

  return {
    total,
    completed,
    rate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function getPhaseLabel(phase: EnglishTrainingDay["phase"]): string {
  switch (phase) {
    case "phase1-foundation":
      return "阶段 1：基础库存";
    case "phase2-bridge":
      return "阶段 2：过渡提升";
    case "phase3-ielts7":
      return "阶段 3：IELTS 7+";
  }
}
