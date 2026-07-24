"use client";

import { ArrowLeft, BarChart2, CalendarDays, RefreshCcw, RotateCcw, Square, Volume2, X } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { HistoryPanel } from "@/components/HistoryPanel";
import { VocabText } from "@/components/VocabText";
import {
  appendAttempt,
  loadGeneratedScenarios,
  loadAttempts,
  loadInsight,
  saveGeneratedScenarios,
  saveInsight
} from "@/lib/storage";
import { speakEnglishWithBestVoice } from "@/lib/speech";
import { DIFFICULTY_OPTIONS, TOPIC_OPTIONS, type Difficulty, type Scenario, type Topic } from "@/types/scenario";
import type { Attempt, InsightReport, InsightState, ScoreResult } from "@/types/scoring";

type AppScreen = "setup" | "practice" | "result";

interface EvaluateApiResponse {
  result?: ScoreResult;
  error?: string;
}

interface GenerateScenarioApiResponse {
  scenario?: Scenario;
  error?: string;
}

interface AnalyzeApiResponse {
  report?: InsightReport;
  error?: string;
}

interface ServerConfigResponse {
  configured?: boolean;
}

const ANALYZE_EVERY = 10;
const BIG_SUMMARY_AT = 100;
const RECENT_PROGRESS_WINDOW = 5;
const SCREEN_TRANSITION_OUT_MS = 150;
const SCREEN_TRANSITION_IN_DELAY_MS = 40;
const SCREEN_TRANSITION_IN_MS = 170;
const SCREEN_TRANSITION_TOTAL_MS =
  SCREEN_TRANSITION_OUT_MS + SCREEN_TRANSITION_IN_DELAY_MS + SCREEN_TRANSITION_IN_MS;

const scoreLabels: Array<{ key: keyof ScoreResult; label: string }> = [
  { key: "meaningAccuracy", label: "意思准确" },
  { key: "grammar", label: "语法" },
  { key: "naturalness", label: "地道感" },
  { key: "spokenStyle", label: "口语感" },
  { key: "toneFit", label: "语气匹配" }
];

interface PracticeAppProps {
  initialAiConfigured?: boolean;
}

export function PracticeApp({ initialAiConfigured }: PracticeAppProps) {
  const [screen, setScreen] = useState<AppScreen>("setup");
  const [transition, setTransition] = useState<{
    from: AppScreen;
    to: AppScreen;
  } | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("beginner");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts());
  const [cachedScenario, setCachedScenario] = useState<Scenario | null>(null);
  const [selectedHistoryAttempt, setSelectedHistoryAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [insight, setInsight] = useState<InsightState>({ totalAttempts: 0, reports: [] });
  const [isInsightOpen, setIsInsightOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(
    typeof initialAiConfigured === "boolean" ? initialAiConfigured : null
  );
  const [recentGeneratedScenarios, setRecentGeneratedScenarios] = useState<Scenario[]>(
    () => loadGeneratedScenarios()
  );
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const transitionTimerRefs = useRef<number[]>([]);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setInsight(loadInsight());

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

  useEffect(() => {
    resizeTextarea();
  }, [answer, screen]);

  useEffect(() => {
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      for (const timerId of transitionTimerRefs.current) {
        window.clearTimeout(timerId);
      }
      transitionTimerRefs.current = [];
    };
  }, []);

  useEffect(() => {
    saveGeneratedScenarios(recentGeneratedScenarios);
  }, [recentGeneratedScenarios]);

  useEffect(() => {
    if (screen !== "result" && isSpeaking) {
      stopSpeech();
    }
  }, [screen, isSpeaking]);

  async function handleGenerateScenario(difficulty = selectedDifficulty) {
    if (transition) {
      return;
    }

    if (aiConfigured === false) {
      setError("AI 服务尚未配置，请先在 Vercel 环境变量里设置 API_KEY。");
      return;
    }

    setSelectedDifficulty(difficulty);
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setAnswer("");
    setSubmittedAnswer("");
    setSelectedHistoryAttempt(null);

    try {
      const recentPromptZh = buildRecentPromptList([
        scenario?.promptZh,
        cachedScenario?.promptZh
      ]);
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "all", difficulty, recentPromptZh })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GenerateScenarioApiResponse
        | Record<string, never>;

      if (!response.ok || !("scenario" in payload) || !payload.scenario) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "生成失败，请稍后再试。"
        );
      }

      rememberGeneratedScenario(payload.scenario);
      setScenario(payload.scenario);
      transitionTo("practice");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "生成失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function prefetchNextScenario(difficulty = selectedDifficulty) {
    if (transition || aiConfigured === false || isPrefetching) {
      return;
    }

    setIsPrefetching(true);
    try {
      const recentPromptZh = buildRecentPromptList([
        scenario?.promptZh,
        cachedScenario?.promptZh
      ]);
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "all", difficulty, recentPromptZh })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GenerateScenarioApiResponse
        | Record<string, never>;

      if (response.ok && "scenario" in payload && payload.scenario) {
        rememberGeneratedScenario(payload.scenario);
        setCachedScenario(payload.scenario);
      }
    } finally {
      setIsPrefetching(false);
    }
  }

  async function triggerAnalysisIfNeeded(nextInsight: InsightState, allAttempts: Attempt[]) {
    if (transition || aiConfigured === false) {
      return;
    }

    const total = nextInsight.totalAttempts;
    const reportCount = nextInsight.reports.length;
    const shouldAnalyze =
      total > 0 &&
      total % ANALYZE_EVERY === 0 &&
      (reportCount === 0 || nextInsight.reports[reportCount - 1].attemptCount < total);

    if (!shouldAnalyze) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const batch = allAttempts.slice(-ANALYZE_EVERY);
      const isBig = total % BIG_SUMMARY_AT === 0;
      const previousReports = isBig ? nextInsight.reports : nextInsight.reports.slice(-1);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempts: batch, previousReports })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | AnalyzeApiResponse
        | Record<string, never>;

      if (response.ok && "report" in payload && payload.report) {
        const updated: InsightState = {
          totalAttempts: total,
          reports: [...nextInsight.reports, payload.report]
        };
        saveInsight(updated);
        setInsight(updated);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSubmit() {
    if (transition || !scenario || !answer.trim()) {
      return;
    }

    if (aiConfigured === false) {
      setError("AI 服务尚未配置，请先在 Vercel 环境变量里设置 API_KEY。");
      return;
    }

    setIsScoring(true);
    setError(null);
    setSelectedHistoryAttempt(null);
    const trimmedAnswer = answer.trim();

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, userAnswer: trimmedAnswer })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | EvaluateApiResponse
        | Record<string, never>;

      if (!response.ok || !("result" in payload) || !payload.result) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "评分失败，请稍后重试。"
        );
      }

      const scoreResult = payload.result;
      setResult(scoreResult);
      setSubmittedAnswer(trimmedAnswer);
      setCachedScenario(null);
      rememberGeneratedScenario(scenario);

      const attempt: Attempt = {
        id: crypto.randomUUID(),
        scenarioId: scenario.id,
        scenarioPromptZh: scenario.promptZh,
        topic: scenario.topic,
        difficulty: scenario.difficulty,
        userAnswer: trimmedAnswer,
        result: scoreResult,
        createdAt: new Date().toISOString()
      };
      const allAttempts = appendAttempt(attempt);
      setAttempts(allAttempts);
      const nextInsight: InsightState = {
        ...insight,
        totalAttempts: insight.totalAttempts + 1
      };
      setInsight(nextInsight);
      saveInsight(nextInsight);

      void prefetchNextScenario(scenario.difficulty);
      void triggerAnalysisIfNeeded(nextInsight, allAttempts);
      transitionTo("result");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "评分失败，请稍后重试。");
    } finally {
      setIsScoring(false);
    }
  }

  function resetToSetup() {
    if (transition) {
      return;
    }

    setSelectedHistoryAttempt(null);
    transitionTo("setup", () => {
      setScenario(null);
      setAnswer("");
      setSubmittedAnswer("");
      setResult(null);
      setError(null);
      setCachedScenario(null);
    });
  }

  function handleNextCachedScenario() {
    if (transition) {
      return;
    }

    if (cachedScenario) {
      setSelectedHistoryAttempt(null);
      setScenario(cachedScenario);
      setSelectedDifficulty(cachedScenario.difficulty);
      setCachedScenario(null);
      setAnswer("");
      transitionTo("practice", () => {
        setSubmittedAnswer("");
        setResult(null);
        setError(null);
      });
      return;
    }

    void handleGenerateScenario(selectedDifficulty);
  }

  function handleAnswerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      insertNewlineAtCursor(event.currentTarget);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function insertNewlineAtCursor(textarea: HTMLTextAreaElement) {
    const start = textarea.selectionStart ?? answer.length;
    const end = textarea.selectionEnd ?? answer.length;
    const nextAnswer = `${answer.slice(0, start)}\n${answer.slice(end)}`;

    setAnswer(nextAnswer);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + 1;
      textarea.selectionEnd = start + 1;
      resizeTextarea(textarea);
    });
  }

  function resizeTextarea(target = textareaRef.current) {
    if (!target) {
      return;
    }

    target.style.height = "auto";
    target.style.height = `${Math.max(target.scrollHeight, 112)}px`;
  }

  function transitionTo(nextScreen: AppScreen, afterTransition?: () => void) {
    if (transition || screen === nextScreen) {
      return;
    }

    stopSpeech();
    for (const timerId of transitionTimerRefs.current) {
      window.clearTimeout(timerId);
    }
    transitionTimerRefs.current = [];

    setTransition({ from: screen, to: nextScreen });
    const switchTimer = window.setTimeout(() => {
      setScreen(nextScreen);
    }, SCREEN_TRANSITION_OUT_MS);
    const clearTimer = window.setTimeout(() => {
      setTransition(null);
      transitionTimerRefs.current = [];
      afterTransition?.();
    }, SCREEN_TRANSITION_TOTAL_MS);

    transitionTimerRefs.current = [switchTimer, clearTimer];
  }

  function rememberGeneratedScenario(nextScenario: Scenario) {
    setRecentGeneratedScenarios((current) => {
      const next = [
        nextScenario,
        ...current.filter(
          (item) =>
            item.id !== nextScenario.id &&
            normalizePrompt(item.promptZh) !== normalizePrompt(nextScenario.promptZh)
        )
      ];

      return next.slice(0, 12);
    });
  }

  function buildRecentPromptList(extraPrompts: Array<string | undefined | null> = []) {
    const prompts = [
      scenario?.promptZh,
      cachedScenario?.promptZh,
      ...attempts.slice(-8).map((item) => item.scenarioPromptZh),
      ...recentGeneratedScenarios.map((item) => item.promptZh),
      ...extraPrompts
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    const seen = new Set<string>();
    const result: string[] = [];

    for (const prompt of prompts) {
      const normalized = normalizePrompt(prompt);
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(prompt);

      if (result.length >= 8) {
        break;
      }
    }

    return result;
  }

  function handleReplayCurrentScenario() {
    if (transition || !scenario) {
      return;
    }

    setError(null);
    setSelectedHistoryAttempt(null);
    setAnswer("");
    transitionTo("practice", () => {
      setSubmittedAnswer("");
      setResult(null);
    });
  }

  function handleSelectHistoryAttempt(attempt: Attempt) {
    setSelectedHistoryAttempt(attempt);
  }

  function handleSpeakBetterAnswer(text: string) {
    if (!speechSupported || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("当前浏览器不支持朗读功能。");
      return;
    }

    stopSpeech();

    const utterance = speakEnglishWithBestVoice(text, {
      pitch: 1,
      rate: 0.92,
      onStart: () => {
        setIsSpeaking(true);
      },
      onEnd: () => {
        setIsSpeaking(false);
      },
      onError: () => {
        setIsSpeaking(false);
      }
    });

    speechUtteranceRef.current = utterance;
  }

  function stopSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    speechUtteranceRef.current = null;
    setIsSpeaking(false);
  }

  const configNotice =
    aiConfigured === false ? "AI 服务尚未配置，请先在 Vercel 环境变量里设置 API_KEY。" : null;
  const isTransitioning = transition !== null;
  const recentProgress = getRecentProgress(attempts);
  const currentReviewAttempt = selectedHistoryAttempt;

  return (
    <main className="minimal-app">
      <header className="minimal-topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">E</span>
          <span className="topbar-title">口语化跟练</span>
        </div>

        <div className="topbar-actions">
          <Link className="icon-text-button" href="/daily-training">
            <CalendarDays size={16} aria-hidden="true" />
            每日训练
          </Link>
          {insight.totalAttempts > 0 && (
            <button
              className="icon-text-button"
              type="button"
              onClick={() => setIsInsightOpen(true)}
            >
              <BarChart2 size={16} aria-hidden="true" />
              分析
              {isAnalyzing && <span className="analyzing-dot" />}
            </button>
          )}
        </div>
      </header>

      {screen === "setup" ? (
        <section className="setup-screen">
          <div className="setup-hero">
            <h1 className="setup-headline">
              选个难度，开始说
              <span>.</span>
            </h1>
            <p className="setup-sub">
              先选难度，系统会自动出一句真实场景里的口语。你只需要写出你平时会怎么说。
            </p>
          </div>

          <div className="difficulty-grid" role="radiogroup" aria-label="难度">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                aria-checked={selectedDifficulty === option.value}
                className="difficulty-option"
                key={option.value}
                onClick={() => setSelectedDifficulty(option.value)}
                role="radio"
                type="button"
              >
                <div className="difficulty-header">
                  <strong>{option.label}</strong>
                  <span className="difficulty-check" aria-hidden="true" />
                </div>
                <span>{getDifficultyHint(option.value)}</span>
              </button>
            ))}
          </div>

          <div className="setup-actions">
            <button
              className="start-button"
              disabled={isGenerating || isTransitioning || aiConfigured === false}
              onClick={() => handleGenerateScenario(selectedDifficulty)}
              type="button"
            >
              {isGenerating ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  正在生成场景…
                </>
              ) : (
                "开始练习"
              )}
            </button>
          </div>

          {configNotice ? <p className="inline-error">{configNotice}</p> : null}
          {error ? <p className="inline-error">{error}</p> : null}
        </section>
      ) : null}

      {screen === "practice" && scenario ? (
        <section className="practice-screen">
          <button className="plain-back" onClick={resetToSetup} type="button" disabled={isTransitioning}>
            <ArrowLeft size={16} aria-hidden="true" />
            换难度
          </button>

          <div className="micro-scenario">
            <span className="scenario-badge">{getDifficultyLabel(scenario.difficulty)}</span>
            <p>{scenario.promptZh}</p>
          </div>

          <div className="scenario-context">
            <div className="context-chip">
              <span>场景</span>
              <strong>{scenario.situation}</strong>
            </div>
            <div className="context-chip">
              <span>关系</span>
              <strong>{scenario.relationship}</strong>
            </div>
            <div className="context-chip">
              <span>氛围</span>
              <strong>{scenario.mood}</strong>
            </div>
          </div>

          <form
            className="one-line-practice"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <HintRow hints={scenario.wordHints ?? []} />
            <textarea
              autoFocus
              disabled={isScoring}
              onKeyDown={handleAnswerKeyDown}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="直接用英文回一句，像平时真的在说话一样。"
              ref={textareaRef}
              rows={4}
              spellCheck={false}
              value={answer}
            />

            {isScoring ? (
              <div className="scoring-overlay">
                <span className="spinner" aria-hidden="true" />
                正在评分…
              </div>
            ) : null}

            <div className="practice-footer">
              <span className="shortcut-hint">Enter 提交 · Ctrl + 空格 换行</span>
              <button
                className="start-button"
                disabled={isScoring || isTransitioning || !answer.trim()}
                type="submit"
              >
                提交
              </button>
            </div>
          </form>

          {error ? <p className="inline-error">{error}</p> : null}
        </section>
      ) : null}

      {screen === "result" && result ? (
        <section className="result-screen">
          <div className="result-score-row">
            <div className="result-score-num">{Math.round(result.score)}</div>
            <div className="result-score-right">
              <span className="result-score-label">本次口语自然度</span>
              <p className="result-score-note">
                先看整体感觉，再往下看更自然的说法和可直接拿走的口语块。
              </p>
            </div>
          </div>

          <div className="coach-spotlight">
            <span className="coach-spotlight-label">这次先抓这一点</span>
            <p>{result.feedbackZh}</p>
          </div>

          <div className="result-compare">
            <div className="result-compare-col">
              <span className="result-col-label">你的回答</span>
              <p className="user-answer-text">{submittedAnswer}</p>
            </div>
            <div className="result-compare-col result-compare-col--better">
              <span className="result-col-label">更自然的说法</span>
              <p className="spoken-answer">
                <VocabText text={result.betterAnswer} example={result.betterAnswer} />
              </p>
              {result.keyPhrases.length > 0 && (
                <div className="word-hints">
                  {result.keyPhrases.map((phrase) => (
                    <span key={phrase}>
                      <VocabText text={phrase} example={result.betterAnswer} />
                    </span>
                  ))}
                </div>
              )}
              <div className="speak-actions">
                <button
                  className="ghost-button"
                  disabled={!speechSupported || isSpeaking}
                  type="button"
                  onClick={() => handleSpeakBetterAnswer(result.betterAnswer)}
                >
                  <Volume2 size={16} aria-hidden="true" />
                  {isSpeaking ? "正在朗读" : "朗读推荐说法"}
                </button>
                {isSpeaking ? (
                  <button className="ghost-button" type="button" onClick={stopSpeech}>
                    <Square size={16} aria-hidden="true" />
                    停止
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <details className="result-metrics-details">
            <summary>展开分项分数</summary>
            <div className="compact-metrics">
              {scoreLabels.map(({ key, label }) => {
                const value = result[key];
                return typeof value === "number" ? (
                  <div key={key} className="metric-cell">
                    <span>{label}</span>
                    <strong>{Math.round(value)}</strong>
                    <div className="metric-mini-bar">
                      <div style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </details>

          <div className="result-detail-grid">
            <div className="result-block">
              <h2>为什么更自然</h2>
              <p>{result.whyBetterZh}</p>
            </div>
            {result.alternatives.length > 0 && (
              <div className="result-block result-block--full">
                <h2>其他说法</h2>
                <ul>
                  {result.alternatives.map((alt) => (
                    <li key={alt}>
                      <VocabText text={alt} example={alt} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="result-actions">
            <button
              className="secondary-button"
              onClick={resetToSetup}
              type="button"
              disabled={isTransitioning}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              换难度
            </button>
            <button
              className="ghost-button"
              disabled={isGenerating || isPrefetching || isTransitioning || !scenario}
              onClick={handleReplayCurrentScenario}
              type="button"
            >
              <RefreshCcw size={16} aria-hidden="true" />
              重写本题
            </button>
            <button
              className="start-button"
              disabled={
                isGenerating ||
                isPrefetching ||
                isTransitioning ||
                (aiConfigured === false && !cachedScenario)
              }
              onClick={handleNextCachedScenario}
              type="button"
            >
              <RotateCcw size={16} aria-hidden="true" />
              {isPrefetching || isGenerating ? "准备中…" : "再来一句"}
            </button>
          </div>

          <div className="result-history-area">
            <div className="progress-summary">
              <div className="progress-summary-head">
                <h2>练习轨迹</h2>
                <span>{attempts.length} 次</span>
              </div>
              <div className="progress-summary-grid">
                <div className="progress-stat">
                  <span>最近 5 次平均</span>
                  <strong>{recentProgress.averageLabel}</strong>
                </div>
                <div className="progress-stat">
                  <span>当前最好分</span>
                  <strong>{recentProgress.bestLabel}</strong>
                </div>
                <div className="progress-stat">
                  <span>较上次变化</span>
                  <strong>{recentProgress.deltaLabel}</strong>
                </div>
                <div className="progress-stat">
                  <span>统计窗口</span>
                  <strong>{recentProgress.sampleCountLabel}</strong>
                </div>
              </div>
            </div>

            <HistoryPanel attempts={attempts} onSelect={handleSelectHistoryAttempt} />
          </div>

          {currentReviewAttempt ? (
            <HistoryReviewCard
              attempt={currentReviewAttempt}
              onClear={() => setSelectedHistoryAttempt(null)}
            />
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}
        </section>
      ) : null}

      {isInsightOpen ? (
        <InsightPanel
          insight={insight}
          isAnalyzing={isAnalyzing}
          onClose={() => setIsInsightOpen(false)}
        />
      ) : null}

      {transition ? (
        <div
          aria-hidden="true"
          className="screen-transition-overlay"
          data-from={transition.from}
          data-to={transition.to}
        />
      ) : null}
    </main>
  );
}

function InsightPanel({
  insight,
  isAnalyzing,
  onClose
}: {
  insight: InsightState;
  isAnalyzing: boolean;
  onClose: () => void;
}) {
  const latest = insight.reports[insight.reports.length - 1];
  const first = insight.reports[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="insight-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>练习分析</h2>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="insight-body">
          <div className="insight-stat-row">
            <div className="insight-stat">
              <strong>{insight.totalAttempts}</strong>
              <span>累计练习</span>
            </div>
            <div className="insight-stat">
              <strong>{insight.reports.length}</strong>
              <span>分析报告</span>
            </div>
          </div>

          {isAnalyzing && (
            <div className="insight-analyzing">
              <span className="spinner" aria-hidden="true" />
              正在生成新的分析报告…
            </div>
          )}

          {!latest && !isAnalyzing && (
            <p className="insight-empty">
              再练 {ANALYZE_EVERY - (insight.totalAttempts % ANALYZE_EVERY)} 次后会自动生成第一份分析报告。
            </p>
          )}

          {latest && (
            <>
              <div className="insight-section">
                <h3>当前弱项</h3>
                <ul>
                  {latest.weaknesses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="insight-section">
                <h3>词汇问题</h3>
                <ul>
                  {latest.vocabularyIssues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="insight-section">
                <h3>综合分析</h3>
                <p>{latest.analysis}</p>
              </div>
              {latest.improvement && (
                <div className="insight-section insight-improvement">
                  <h3>进步</h3>
                  <p>{latest.improvement}</p>
                </div>
              )}
              {insight.reports.length > 1 && first !== latest && (
                <div className="insight-section insight-history">
                  <h3>第一份报告（{first.attemptCount} 次练习时）</h3>
                  <p className="insight-muted">{first.analysis}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HintRow({ hints }: { hints: string[] }) {
  if (hints.length === 0) {
    return null;
  }

  return (
    <div className="word-hints" aria-label="词感提示">
      {hints.slice(0, 2).map((hint) => (
        <span key={hint}>{hint}</span>
      ))}
    </div>
  );
}

function getDifficultyLabel(value: Difficulty): string {
  return DIFFICULTY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getDifficultyHint(value: Difficulty): string {
  switch (value) {
    case "beginner":
      return "短句、直接、先把话说出来";
    case "intermediate":
      return "更像真实聊天，会有一点语气和情绪";
    case "advanced":
      return "更本土、更自然，也更像真人会说的话";
  }
}

interface RecentProgressSummary {
  averageLabel: string;
  bestLabel: string;
  deltaLabel: string;
  sampleCountLabel: string;
}

function getRecentProgress(attempts: Attempt[]): RecentProgressSummary {
  const recentAttempts = attempts.slice(-RECENT_PROGRESS_WINDOW);
  const recentScores = recentAttempts.map((attempt) => attempt.result.score);
  const average =
    recentScores.length > 0
      ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
      : null;
  const best = attempts.length > 0 ? Math.max(...attempts.map((attempt) => attempt.result.score)) : null;
  const current = attempts.at(-1)?.result.score ?? null;
  const previous = attempts.at(-2)?.result.score ?? null;
  const delta = current != null && previous != null ? current - previous : null;

  return {
    averageLabel: formatScoreLabel(average),
    bestLabel: formatScoreLabel(best),
    deltaLabel: formatDeltaLabel(delta),
    sampleCountLabel: `${recentAttempts.length}/${RECENT_PROGRESS_WINDOW}`
  };
}

function formatScoreLabel(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "暂无";
  }

  return `${Math.round(value)} 分`;
}

function formatDeltaLabel(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  const rounded = Math.round(value);
  if (rounded === 0) {
    return "持平";
  }

  return `${rounded > 0 ? "+" : ""}${rounded} 分`;
}

function getTopicLabel(value: Topic): string {
  return TOPIC_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatAttemptTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function HistoryReviewCard({
  attempt,
  onClear
}: {
  attempt: Attempt;
  onClear: () => void;
}) {
  return (
    <section className="panel history-review" aria-live="polite">
      <div className="history-review-head">
        <div>
          <span className="history-review-kicker">回看这一题</span>
          <h2>{attempt.scenarioPromptZh}</h2>
          <div className="history-review-meta">
            <span>{getDifficultyLabel(attempt.difficulty)}</span>
            <span>{getTopicLabel(attempt.topic)}</span>
            <span>{formatAttemptTime(attempt.createdAt)}</span>
          </div>
        </div>

        <button className="icon-button" type="button" onClick={onClear} aria-label="关闭回看">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="history-review-grid">
        <div className="history-review-block">
          <span>你的回答</span>
          <p>{attempt.userAnswer}</p>
        </div>

        <div className="history-review-block history-review-block--accent">
          <span>更自然的说法</span>
          <p>
            <VocabText text={attempt.result.betterAnswer} example={attempt.result.betterAnswer} />
          </p>
        </div>
      </div>

      <div className="history-review-grid">
        <div className="history-review-block">
          <span>AI 反馈</span>
          <p>{attempt.result.feedbackZh}</p>
        </div>

        <div className="history-review-block">
          <span>为什么更自然</span>
          <p>{attempt.result.whyBetterZh}</p>
        </div>
      </div>

      {attempt.result.keyPhrases.length > 0 ? (
        <div className="history-review-block history-review-block--full">
          <span>关键口语块</span>
          <div className="word-hints history-review-tags">
            {attempt.result.keyPhrases.map((phrase) => (
              <span key={phrase}>{phrase}</span>
            ))}
          </div>
        </div>
      ) : null}

      {attempt.result.alternatives.length > 0 ? (
        <div className="history-review-block history-review-block--full">
          <span>其他说法</span>
          <ul className="history-review-list">
            {attempt.result.alternatives.map((alternative) => (
              <li key={alternative}>
                <VocabText text={alternative} example={alternative} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function normalizePrompt(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u3000，。！？、,.!?;；:：'"“”‘’（）()[\]{}<>《》【】\-_]/g, "");
}
