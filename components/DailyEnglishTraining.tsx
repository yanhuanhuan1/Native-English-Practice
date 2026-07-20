"use client";

import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Mic,
  Pause,
  RotateCcw,
  Sparkles,
  Star,
  Volume2
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DailyTraining,
  DailyTrainingHistorySummary,
  EnglishTrainingRecord,
  ExpressionMastery,
  ReviewItem,
  SpeakingFeedback,
  TrainingExpression,
  TrainingStep
} from "@/types/daily-training";

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

const steps: { key: TrainingStep; label: string; title: string }[] = [
  { key: "listening", label: "Listening", title: "输入" },
  { key: "expression", label: "Expression", title: "理解" },
  { key: "practice", label: "Practice", title: "练习" },
  { key: "speaking", label: "Speaking", title: "输出" },
  { key: "review", label: "Review", title: "复习" }
];

export function DailyEnglishTraining() {
  const [records, setRecords] = useState<EnglishTrainingRecord[]>([]);
  const [activeDate, setActiveDate] = useState(() => getTodayKey());
  const [activeStep, setActiveStep] = useState<TrainingStep>("listening");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

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
    () => [...records].sort((left, right) => right.training.date.localeCompare(left.training.date)),
    [records]
  );
  const currentRecord =
    records.find((record) => record.training.date === activeDate) ?? null;
  const currentTraining = currentRecord?.training ?? null;
  const progress = getProgress(records);
  const nextDayNumber = currentTraining?.dayNumber ?? getNextDayNumber(records);

  useEffect(() => {
    setActiveStep(currentTraining?.activeStep ?? "listening");
  }, [currentTraining?.date, currentTraining?.activeStep]);

  async function handleGenerate(regenerate = false) {
    if (aiConfigured === false) {
      setError("AI 服务尚未配置。上线版本需要在 Vercel 环境变量里配置 API_KEY。");
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
        training: ensureTrainingDefaults(payload.training),
        completedSteps: []
      });
      persistRecords(nextRecords);
      setRecords(nextRecords);
      setActiveStep("listening");
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "生成失败，请稍后重试。"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function updateCurrentTraining(updater: (training: DailyTraining) => DailyTraining) {
    if (!currentTraining) {
      return;
    }

    const nextTraining = updater(currentTraining);
    const completedSteps = steps
      .filter((step) => nextTraining.stepStatus[step.key])
      .map((step) => step.key);
    const nextRecord: EnglishTrainingRecord = {
      ...(currentRecord ?? { completedSteps: [] }),
      training: {
        ...nextTraining,
        completed: completedSteps.length === steps.length
      },
      completedSteps,
      completedAt: completedSteps.length === steps.length ? new Date().toISOString() : currentRecord?.completedAt
    };
    const nextRecords = upsertRecord(records, nextRecord);

    persistRecords(nextRecords);
    setRecords(nextRecords);
  }

  function completeStep(step: TrainingStep) {
    const nextStep = getNextStep(step);

    updateCurrentTraining((training) => ({
      ...training,
      activeStep: nextStep ?? step,
      stepStatus: {
        ...training.stepStatus,
        [step]: true
      }
    }));

    if (nextStep) {
      setActiveStep(nextStep);
    }
  }

  return (
    <main className="daily-training-page daily-training-flow-page">
      <header className="daily-training-topbar daily-training-flow-topbar">
        <div>
          <span className="daily-training-kicker">Daily English Training</span>
          <h1>每日英语训练</h1>
        </div>
        <Link className="daily-training-link" href="/">
          返回口语跟练
        </Link>
      </header>

      <section className="daily-training-flow-shell">
        <aside className="daily-training-flow-side">
          <Panel title="训练日期" icon={<CalendarDays size={18} aria-hidden="true" />}>
            <input
              aria-label="训练日期"
              className="daily-training-date-input"
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
                AI 服务尚未配置。请在 Vercel 环境变量中设置 API_KEY。
              </p>
            ) : null}
            {error ? <p className="daily-training-error">{error}</p> : null}
          </Panel>

          <Panel title="成长统计" icon={<Star size={18} aria-hidden="true" />}>
            <div className="daily-training-metric-grid">
              <Metric label="Total Days" value={`${progress.totalDays}`} />
              <Metric label="Expressions" value={`${progress.learnedExpressions}`} />
              <Metric label="Listening" value={`${progress.listeningHours}h`} />
              <Metric label="Speaking" value={`${progress.speakingPracticeCount}`} />
              <Metric label="Review" value={`${progress.reviewAccuracy}%`} />
            </div>
          </Panel>

          <Panel title="薄弱点" icon={<RotateCcw size={18} aria-hidden="true" />}>
            <WeaknessList training={currentTraining} />
          </Panel>

          <Panel title="最近记录" icon={<CheckCircle2 size={18} aria-hidden="true" />}>
            {sortedRecords.length === 0 ? (
              <p className="daily-training-muted">还没有训练记录。</p>
            ) : (
              <div className="daily-training-history-list">
                {sortedRecords.slice(0, 8).map((record) => (
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
          </Panel>
        </aside>

        <section className="daily-training-workspace">
          {!currentTraining ? (
            <EmptyTrainingState
              isGenerating={isGenerating}
              onGenerate={() => void handleGenerate(false)}
            />
          ) : (
            <>
              <TrainingHeader
                activeStep={activeStep}
                onStepChange={setActiveStep}
                training={currentTraining}
              />
              <div className="daily-training-step-stage">
                {activeStep === "listening" ? (
                  <ListeningStep training={currentTraining} onDone={() => completeStep("listening")} />
                ) : null}
                {activeStep === "expression" ? (
                  <ExpressionStep
                    expressions={currentTraining.expressions}
                    onDone={() => completeStep("expression")}
                    onUpdateExpression={(expressionId, updates) =>
                      updateCurrentTraining((training) => ({
                        ...training,
                        expressions: training.expressions.map((expression) =>
                          expression.id === expressionId
                            ? { ...expression, ...updates }
                            : expression
                        )
                      }))
                    }
                  />
                ) : null}
                {activeStep === "practice" ? (
                  <PracticeStep training={currentTraining} onDone={() => completeStep("practice")} />
                ) : null}
                {activeStep === "speaking" ? (
                  <SpeakingStep
                    training={currentTraining}
                    onDone={() => completeStep("speaking")}
                    onFeedback={(answer, feedback) =>
                      updateCurrentTraining((training) => ({
                        ...training,
                        speaking: {
                          ...training.speaking,
                          answer,
                          feedback
                        }
                      }))
                    }
                  />
                ) : null}
                {activeStep === "review" ? (
                  <ReviewStep
                    training={currentTraining}
                    onDone={() => completeStep("review")}
                    onUpdateReview={(review) =>
                      updateCurrentTraining((training) => ({ ...training, review }))
                    }
                  />
                ) : null}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function TrainingHeader({
  activeStep,
  onStepChange,
  training
}: {
  activeStep: TrainingStep;
  onStepChange: (step: TrainingStep) => void;
  training: DailyTraining;
}) {
  return (
    <section className="daily-training-flow-header">
      <div>
        <span>Day {training.dayNumber}</span>
        <h2>{training.topic}</h2>
        <p>{training.level} · {training.date}</p>
      </div>
      <nav className="daily-training-step-tabs" aria-label="学习进度">
        {steps.map((step) => (
          <button
            aria-current={activeStep === step.key ? "step" : undefined}
            className="daily-training-step-tab"
            key={step.key}
            type="button"
            onClick={() => onStepChange(step.key)}
          >
            <span>{training.stepStatus[step.key] ? <CheckCircle2 size={16} /> : step.title}</span>
            <strong>{step.label}</strong>
          </button>
        ))}
      </nav>
    </section>
  );
}

function ListeningStep({
  onDone,
  training
}: {
  onDone: () => void;
  training: DailyTraining;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const resource = training.listening.resource;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  return (
    <StepPanel eyebrow="Step 1" title="Listening Input" actionLabel="我听完了，进入表达库" onAction={onDone}>
      <div className="daily-training-player-layout">
        <div className="daily-training-player">
          {resource.playerType === "youtube" && resource.embedUrl ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              src={resource.embedUrl}
              title={resource.title}
            />
          ) : null}
          {resource.playerType === "audio" && resource.audioUrl ? (
            <audio ref={audioRef} controls loop={loop} src={resource.audioUrl}>
              你的浏览器不支持音频播放。
            </audio>
          ) : null}
          {resource.playerType === "web" || (!resource.embedUrl && !resource.audioUrl) ? (
            <iframe src={resource.url} title={resource.title} />
          ) : null}
        </div>
        <div className="daily-training-resource-summary">
          <span>{resource.source}</span>
          <h3>{resource.title}</h3>
          <p>{resource.whySuitable}</p>
          <div className="daily-training-tag-row">
            <span>{resource.level}</span>
            <span>{resource.duration}</span>
          </div>
          <a href={resource.url} target="_blank" rel="noreferrer">
            原始资源
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="daily-training-controls">
        <button
          aria-pressed={showTranscript}
          className="daily-training-ghost"
          type="button"
          onClick={() => setShowTranscript((value) => !value)}
        >
          字幕 / 文本
        </button>
        <button
          aria-pressed={loop}
          className="daily-training-ghost"
          type="button"
          onClick={() => setLoop((value) => !value)}
        >
          循环
        </button>
        {[0.75, 1, 1.25].map((rate) => (
          <button
            aria-pressed={speed === rate}
            className="daily-training-ghost"
            key={rate}
            type="button"
            onClick={() => setSpeed(rate)}
          >
            {rate}x
          </button>
        ))}
      </div>

      <div className="daily-training-task-strip">
        <TaskNote title="第一遍">{training.listening.firstListen.instruction}</TaskNote>
        <TaskNote title="抓大意">{training.listening.firstListen.questions.join(" / ")}</TaskNote>
        <TaskNote title="第二遍">{training.listening.secondListen.task}</TaskNote>
      </div>

      {showTranscript ? (
        <div className="daily-training-transcript">
          {training.listening.transcript || "这个资源没有提供可直接展示的字幕，请使用播放器字幕或浏览器翻译插件辅助。"}
        </div>
      ) : null}
    </StepPanel>
  );
}

function ExpressionStep({
  expressions,
  onDone,
  onUpdateExpression
}: {
  expressions: TrainingExpression[];
  onDone: () => void;
  onUpdateExpression: (
    expressionId: string,
    updates: Partial<Pick<TrainingExpression, "favorite" | "mastery">>
  ) => void;
}) {
  return (
    <StepPanel eyebrow="Step 2" title="Expression Bank" actionLabel="表达过一遍了，去练习" onAction={onDone}>
      <div className="daily-training-expression-list">
        {expressions.map((item) => (
          <article className="daily-training-expression-row" key={item.id}>
            <div>
              <h3>{item.expression}</h3>
              <p>{item.meaning}</p>
              <small>{item.scenario} · {item.pronunciation}</small>
              <q>{item.example}</q>
            </div>
            <div className="daily-training-expression-actions">
              <button
                className="daily-training-icon-button"
                type="button"
                title="朗读"
                onClick={() => speak(item.expression)}
              >
                <Volume2 size={17} />
              </button>
              <button
                className="daily-training-icon-button"
                type="button"
                title={item.favorite ? "取消收藏" : "收藏"}
                onClick={() => onUpdateExpression(item.id, { favorite: !item.favorite })}
              >
                {item.favorite ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>
              <MasteryControl
                value={item.mastery}
                onChange={(mastery) => onUpdateExpression(item.id, { mastery })}
              />
            </div>
          </article>
        ))}
      </div>
    </StepPanel>
  );
}

function PracticeStep({
  onDone,
  training
}: {
  onDone: () => void;
  training: DailyTraining;
}) {
  const [fillAnswers, setFillAnswers] = useState<Record<string, string>>({});
  const [replacementAnswers, setReplacementAnswers] = useState<Record<string, string>>({});
  const [builderAnswers, setBuilderAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  return (
    <StepPanel eyebrow="Step 3" title="Practice Module" actionLabel="练习完成，去口语输出" onAction={onDone}>
      <section className="daily-training-practice-block">
        <h3>A. Fill Blank</h3>
        {training.practice.fillBlank.map((item) => (
          <label className="daily-training-inline-task" key={item.id}>
            <span>{item.prompt}</span>
            <input
              value={fillAnswers[item.id] ?? ""}
              onChange={(event) =>
                setFillAnswers((answers) => ({ ...answers, [item.id]: event.target.value }))
              }
              placeholder={item.hint ?? "填入缺失表达"}
            />
            {checked ? (
              <small>{isSameAnswer(fillAnswers[item.id], item.answer) ? "正确" : `参考：${item.answer}`}</small>
            ) : null}
          </label>
        ))}
      </section>

      <section className="daily-training-practice-block">
        <h3>B. Expression Replacement</h3>
        {training.practice.replacements.map((item) => (
          <div className="daily-training-replacement" key={item.id}>
            <p>{item.baseSentence}</p>
            <div className="daily-training-tag-row">
              {item.replacements.map((replacement) => (
                <span key={replacement}>{item.targetWord} → {replacement}</span>
              ))}
            </div>
            <textarea
              value={replacementAnswers[item.id] ?? ""}
              onChange={(event) =>
                setReplacementAnswers((answers) => ({ ...answers, [item.id]: event.target.value }))
              }
              placeholder="把句子迁移到新场景里"
              rows={3}
            />
            {checked ? <small>参考：{item.modelAnswer}</small> : null}
          </div>
        ))}
      </section>

      <section className="daily-training-practice-block">
        <h3>C. Sentence Builder</h3>
        {training.practice.sentenceBuilders.map((item) => (
          <div className="daily-training-replacement" key={item.id}>
            <p>{item.context}</p>
            <div className="daily-training-tag-row">
              {item.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
            <textarea
              value={builderAnswers[item.id] ?? ""}
              onChange={(event) =>
                setBuilderAnswers((answers) => ({ ...answers, [item.id]: event.target.value }))
              }
              placeholder="用这些关键词说成一句自然英文"
              rows={3}
            />
            {checked ? <small>参考：{item.modelAnswer}</small> : null}
          </div>
        ))}
      </section>

      <button className="daily-training-ghost" type="button" onClick={() => setChecked(true)}>
        查看参考答案
      </button>
    </StepPanel>
  );
}

function SpeakingStep({
  onDone,
  onFeedback,
  training
}: {
  onDone: () => void;
  onFeedback: (answer: string, feedback: SpeakingFeedback) => void;
  training: DailyTraining;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [answer, setAnswer] = useState(training.speaking.answer ?? "");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState<SpeakingFeedback | undefined>(training.speaking.feedback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("浏览器没有拿到麦克风权限。你也可以直接把回答打在下面。");
    }
  }

  async function submitSpeaking() {
    if (!answer.trim()) {
      setError("请先写下你刚才说的英文，AI 才能分析。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/daily-training/speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer,
          question: training.speaking.question,
          topic: training.topic,
          expressions: training.expressions.map((item) => item.expression)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as SpeakingFeedbackApiResponse;

      if (!response.ok || !payload.feedback) {
        throw new Error(payload.error ?? "口语反馈生成失败，请稍后重试。");
      }

      setFeedback(payload.feedback);
      onFeedback(answer.trim(), payload.feedback);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "口语反馈生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepPanel eyebrow="Step 4" title="Speaking Practice" actionLabel="完成口语，进入复习" onAction={onDone}>
      <div className="daily-training-speaking-prompt">
        <span>今日口语题</span>
        <h3>{training.speaking.question}</h3>
      </div>
      <div className="daily-training-controls">
        <button className="daily-training-primary" type="button" onClick={() => void toggleRecording()}>
          {recording ? <Pause size={17} /> : <Mic size={17} />}
          {recording ? "停止录音" : "开始录音"}
        </button>
        {audioUrl ? (
          <audio controls src={audioUrl}>
            你的浏览器不支持音频播放。
          </audio>
        ) : null}
      </div>
      <label className="daily-training-answer-box">
        <span>把你说的英文写在这里，提交给 AI 口语教练分析</span>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="例如：I am responsible for keeping the team updated..."
          rows={5}
        />
      </label>
      <button className="daily-training-primary" disabled={loading} type="button" onClick={() => void submitSpeaking()}>
        {loading ? <Loader2 className="daily-training-spin" size={17} /> : <Sparkles size={17} />}
        AI 分析口语
      </button>
      {error ? <p className="daily-training-error">{error}</p> : null}
      {feedback ? <SpeakingFeedbackPanel feedback={feedback} /> : null}
    </StepPanel>
  );
}

function ReviewStep({
  onDone,
  onUpdateReview,
  training
}: {
  onDone: () => void;
  onUpdateReview: (review: ReviewItem[]) => void;
  training: DailyTraining;
}) {
  const [items, setItems] = useState(training.review);

  function updateItem(expressionId: string, updates: Partial<ReviewItem>) {
    const nextItems = items.map((item) =>
      item.expressionId === expressionId ? { ...item, ...updates } : item
    );
    setItems(nextItems);
    onUpdateReview(nextItems);
  }

  return (
    <StepPanel eyebrow="Step 5" title="Today's Review" actionLabel="完成今日训练" onAction={onDone}>
      <div className="daily-training-reading-card">
        <span>Daily Reading Card</span>
        <h3>{training.reading.title}</h3>
        <p className="daily-training-muted">
          {training.reading.source} · {training.reading.level}
        </p>
        <p>{renderReadingText(training.reading.text, training.reading.highlightedExpressions)}</p>
        <div className="daily-training-zh-assist">{training.reading.zhAssist}</div>
        <a href={training.reading.url} target="_blank" rel="noreferrer">
          阅读来源
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>

      <div className="daily-training-review-list">
        {items.map((item) => (
          <article className="daily-training-review-item" key={item.expressionId}>
            <div>
              <h3>{item.expression}</h3>
              <p>{item.meaning}</p>
              <small>{item.prompt}</small>
            </div>
            <textarea
              value={item.userSentence ?? ""}
              onChange={(event) =>
                updateItem(item.expressionId, { userSentence: event.target.value })
              }
              placeholder="用这个表达重新造一句自己的话"
              rows={3}
            />
            <div className="daily-training-controls">
              <button
                aria-pressed={item.correct === true}
                className="daily-training-ghost"
                type="button"
                onClick={() => updateItem(item.expressionId, { correct: true })}
              >
                会用了
              </button>
              <button
                aria-pressed={item.correct === false}
                className="daily-training-ghost"
                type="button"
                onClick={() => updateItem(item.expressionId, { correct: false })}
              >
                还不熟
              </button>
            </div>
          </article>
        ))}
      </div>
    </StepPanel>
  );
}

function SpeakingFeedbackPanel({ feedback }: { feedback: SpeakingFeedback }) {
  return (
    <div className="daily-training-feedback">
      <div className="daily-training-score-row">
        <Metric label="Fluency" value={`${feedback.fluency}`} />
        <Metric label="Grammar" value={`${feedback.grammar}`} />
        <Metric label="Vocabulary" value={`${feedback.vocabulary}`} />
        <Metric label="Naturalness" value={`${feedback.naturalness}`} />
      </div>
      <p>{feedback.suggestion}</p>
      <q>{feedback.betterVersion}</q>
    </div>
  );
}

function MasteryControl({
  onChange,
  value
}: {
  onChange: (value: ExpressionMastery) => void;
  value: ExpressionMastery;
}) {
  const options: { key: ExpressionMastery; label: string }[] = [
    { key: "new", label: "新学" },
    { key: "learning", label: "练习中" },
    { key: "mastered", label: "掌握" }
  ];

  return (
    <div className="daily-training-mastery" aria-label="掌握程度">
      {options.map((option) => (
        <button
          aria-pressed={value === option.key}
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StepPanel({
  actionLabel,
  children,
  eyebrow,
  onAction,
  title
}: {
  actionLabel: string;
  children: ReactNode;
  eyebrow: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <section className="daily-training-step-panel">
      <div className="daily-training-step-heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
      <div className="daily-training-step-footer">
        <button className="daily-training-primary" type="button" onClick={onAction}>
          {actionLabel}
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function Panel({
  children,
  icon,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="daily-training-side-panel">
      <div className="daily-training-card-head">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TaskNote({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{children}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="daily-training-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WeaknessList({ training }: { training: DailyTraining | null }) {
  if (!training) {
    return <p className="daily-training-muted">生成训练后会看到今日重点。</p>;
  }

  const items = [
    ...training.weaknesses.listening,
    ...training.weaknesses.expression,
    ...training.weaknesses.speaking,
    ...training.weaknesses.reading
  ].slice(0, 6);

  return (
    <div className="daily-training-tag-row">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
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
    <section className="daily-training-empty daily-training-flow-empty">
      <span>Daily English Training</span>
      <h2>今天只做一轮完整训练</h2>
      <p>
        系统会通过 AI agent 寻找真实输入资源，然后按听力输入、表达积累、主动练习、口语输出和间隔复习生成任务。
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
    const parsed = rawValue ? (JSON.parse(rawValue) as unknown) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTrainingRecord).map((record) => ({
      ...record,
      training: ensureTrainingDefaults(record.training),
      completedSteps: record.completedSteps ?? []
    }));
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
  const next = records.filter((record) => record.training.date !== nextRecord.training.date);

  return [...next, nextRecord].sort((left, right) =>
    left.training.date.localeCompare(right.training.date)
  );
}

function buildHistorySummary(records: EnglishTrainingRecord[]): DailyTrainingHistorySummary {
  const completedRecords = records.filter((record) => record.training.completed);
  const recentRecords = [...records]
    .sort((left, right) => right.training.date.localeCompare(left.training.date))
    .slice(0, 8);
  const allExpressions = records.flatMap((record) => record.training.expressions);
  const dueReviewExpressions = allExpressions
    .filter((expression) => expression.reviewDate <= getTodayKey())
    .map((expression) => expression.expression)
    .slice(0, 12);

  return {
    totalDays: records.length,
    completedDays: completedRecords.length,
    learnedExpressions: allExpressions.length,
    reviewAccuracy: getProgress(records).reviewAccuracy,
    recentTopics: recentRecords.map((record) => record.training.topic),
    recentWeaknesses: recentRecords
      .flatMap((record) => [
        ...record.training.weaknesses.listening,
        ...record.training.weaknesses.expression,
        ...record.training.weaknesses.speaking,
        ...record.training.weaknesses.reading
      ])
      .slice(0, 12),
    dueReviewExpressions,
    recentFeedback: recentRecords
      .map((record) =>
        [
          record.training.speaking.answer,
          record.training.speaking.feedback?.suggestion,
          record.feedback?.practiceNotes
        ]
          .filter(Boolean)
          .join(" | ")
      )
      .filter((value) => value.trim().length > 0)
  };
}

function getProgress(records: EnglishTrainingRecord[]) {
  const expressions = records.flatMap((record) => record.training.expressions);
  const reviewItems = records.flatMap((record) => record.training.review);
  const reviewedItems = reviewItems.filter((item) => typeof item.correct === "boolean");
  const correctReviews = reviewedItems.filter((item) => item.correct).length;
  const listeningMinutes = records.reduce(
    (total, record) => total + parseDurationMinutes(record.training.listening.resource.duration),
    0
  );

  return {
    totalDays: records.length,
    learnedExpressions: expressions.length,
    listeningHours: Math.round((listeningMinutes / 60) * 10) / 10,
    speakingPracticeCount: records.filter((record) => record.training.speaking.answer).length,
    reviewAccuracy:
      reviewedItems.length > 0 ? Math.round((correctReviews / reviewedItems.length) * 100) : 0
  };
}

function getNextDayNumber(records: EnglishTrainingRecord[]): number {
  if (records.length === 0) {
    return 1;
  }

  return Math.max(...records.map((record) => record.training.dayNumber)) + 1;
}

function getNextStep(step: TrainingStep): TrainingStep | null {
  const index = steps.findIndex((item) => item.key === step);
  return steps[index + 1]?.key ?? null;
}

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function ensureTrainingDefaults(training: DailyTraining): DailyTraining {
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
    expressions: training.expressions.map((expression) => ({
      ...expression,
      favorite: !!expression.favorite,
      mastery: expression.mastery ?? "new"
    }))
  };
}

function isTrainingRecord(value: unknown): value is EnglishTrainingRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EnglishTrainingRecord>;
  const training = record.training as Partial<DailyTraining> | undefined;

  return !!(
    training?.date &&
    training.dayNumber &&
    training.listening &&
    Array.isArray(training.expressions) &&
    training.practice &&
    training.speaking &&
    training.reading
  );
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function renderReadingText(text: string, highlights: { expression: string; meaning: string }[]) {
  const expressions = highlights
    .map((highlight) => highlight.expression)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  if (expressions.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${expressions.map(escapeRegExp).join("|")})`, "gi");

  return text.split(pattern).map((part, index) => {
    const highlight = highlights.find(
      (item) => item.expression.toLowerCase() === part.toLowerCase()
    );

    return highlight ? (
      <mark key={`${part}-${index}`} title={`${highlight.meaning}`}>
        {part}
      </mark>
    ) : (
      part
    );
  });
}

function parseDurationMinutes(duration: string): number {
  const minuteMatch = duration.match(/(\d+)\s*(min|minute|分钟|分)/i);

  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const numberMatch = duration.match(/\d+/);
  return numberMatch ? Number(numberMatch[0]) : 5;
}

function isSameAnswer(left?: string, right?: string): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
