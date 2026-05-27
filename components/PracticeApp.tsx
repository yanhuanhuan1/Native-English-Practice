"use client";

import { ArrowLeft, BarChart2, RotateCcw, Settings, X } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { DEFAULT_API_SETTINGS, getProviderPreset } from "@/lib/ai/config";
import {
  appendAttempt,
  loadInsight,
  loadSettings,
  saveInsight,
  saveSettings
} from "@/lib/storage";
import { SettingsModal } from "@/components/SettingsModal";
import { VocabText } from "@/components/VocabText";
import {
  DIFFICULTY_OPTIONS,
  type Difficulty,
  type Scenario
} from "@/types/scenario";
import type { Attempt, InsightReport, InsightState, ScoreResult } from "@/types/scoring";
import type { ApiSettings } from "@/types/settings";

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

const scoreLabels: Array<{ key: keyof ScoreResult; label: string }> = [
  { key: "meaningAccuracy", label: "意思" },
  { key: "grammar", label: "听得懂" },
  { key: "naturalness", label: "本土感" },
  { key: "spokenStyle", label: "口语感" },
  { key: "toneFit", label: "语气" }
];

const ANALYZE_EVERY = 10;
const BIG_SUMMARY_AT = 100;

export function PracticeApp() {
  const [settings, setSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);
  const [screen, setScreen] = useState<AppScreen>("setup");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("beginner");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [cachedScenario, setCachedScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [insight, setInsight] = useState<InsightState>({ totalAttempts: 0, reports: [] });
  const [isInsightOpen, setIsInsightOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setInsight(loadInsight());
    const unlocked = sessionStorage.getItem("admin-unlocked") === "1";
    setAdminUnlocked(unlocked);
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { hasServerKey?: boolean }) => setHasServerKey(!!d.hasServerKey))
      .catch(() => {});
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [answer, screen]);

  async function handleGenerateScenario(difficulty = selectedDifficulty) {
    if (!hasServerKey && !settings.apiKey.trim()) {
      setError(`请先在设置里填写 ${getProviderPreset(settings.providerId).apiKeyLabel}。`);
      setIsSettingsOpen(true);
      return;
    }

    setSelectedDifficulty(difficulty);
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setAnswer("");

    try {
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "all", difficulty, settings })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GenerateScenarioApiResponse
        | Record<string, never>;

      if (!response.ok || !("scenario" in payload) || !payload.scenario) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "生成失败，请稍后重试。"
        );
      }

      setScenario(payload.scenario);
      setScreen("practice");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "生成失败，请稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function prefetchNextScenario(difficulty = selectedDifficulty) {
    if (!settings.apiKey.trim() || isPrefetching) return;

    setIsPrefetching(true);
    try {
      const response = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "all", difficulty, settings })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | GenerateScenarioApiResponse
        | Record<string, never>;

      if (response.ok && "scenario" in payload && payload.scenario) {
        setCachedScenario(payload.scenario);
      }
    } finally {
      setIsPrefetching(false);
    }
  }

  async function triggerAnalysisIfNeeded(nextInsight: InsightState, allAttempts: Attempt[]) {
    const total = nextInsight.totalAttempts;
    const reportCount = nextInsight.reports.length;
    const shouldAnalyze =
      total > 0 &&
      total % ANALYZE_EVERY === 0 &&
      (reportCount === 0 || nextInsight.reports[reportCount - 1].attemptCount < total);

    if (!shouldAnalyze || !settings.apiKey.trim()) return;

    setIsAnalyzing(true);
    try {
      const batch = allAttempts.slice(-ANALYZE_EVERY);
      const isBig = total % BIG_SUMMARY_AT === 0;
      const previousReports = isBig ? nextInsight.reports : nextInsight.reports.slice(-1);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempts: batch, previousReports, settings })
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
    if (!scenario || !answer.trim()) return;

    if (!hasServerKey && !settings.apiKey.trim()) {
      setError(`请先在设置里填写 ${getProviderPreset(settings.providerId).apiKeyLabel}。`);
      setIsSettingsOpen(true);
      return;
    }

    setIsScoring(true);
    setError(null);
    const trimmedAnswer = answer.trim();

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, userAnswer: trimmedAnswer, settings })
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
      setScreen("result");
      setCachedScenario(null);

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
      const nextInsight: InsightState = {
        ...insight,
        totalAttempts: insight.totalAttempts + 1
      };
      setInsight(nextInsight);
      saveInsight(nextInsight);

      void prefetchNextScenario(scenario.difficulty);
      void triggerAnalysisIfNeeded(nextInsight, allAttempts);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "评分失败，请稍后重试。");
    } finally {
      setIsScoring(false);
    }
  }

  function handleSaveSettings(nextSettings: ApiSettings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
    setIsSettingsOpen(false);
    setError(null);
  }

  function resetToSetup() {
    setScreen("setup");
    setScenario(null);
    setAnswer("");
    setSubmittedAnswer("");
    setResult(null);
    setError(null);
    setCachedScenario(null);
  }

  function handleNextCachedScenario() {
    if (cachedScenario) {
      setScenario(cachedScenario);
      setSelectedDifficulty(cachedScenario.difficulty);
      setCachedScenario(null);
      setAnswer("");
      setSubmittedAnswer("");
      setResult(null);
      setError(null);
      setScreen("practice");
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
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextAnswer = `${answer.slice(0, start)}\n${answer.slice(end)}`;
    setAnswer(nextAnswer);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + 1;
      textarea.selectionEnd = start + 1;
      resizeTextarea(textarea);
    });
  }

  function resizeTextarea(target = textareaRef.current) {
    if (!target) return;
    target.style.height = "auto";
    target.style.height = `${Math.max(target.scrollHeight, 210)}px`;
  }

  return (
    <main className="minimal-app">
      <header className="minimal-topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">E</span>
          <span className="topbar-title">口语跟练</span>
        </div>
        <div className="topbar-actions">
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
          <button
            className="icon-button topbar-admin-btn"
            type="button"
            title="管理员"
            onClick={() => {
              if (adminUnlocked) {
                setIsSettingsOpen(true);
              } else {
                setShowAdminPrompt(true);
              }
            }}
          >
            <Settings size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      {screen === "setup" ? (
        <section className="setup-screen">
          <div className="setup-hero">
            <h1 className="setup-headline">
              Speak<span>.</span>
            </h1>
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
              disabled={isGenerating}
              onClick={() => handleGenerateScenario(selectedDifficulty)}
              type="button"
            >
              {isGenerating ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  正在生成场景…
                </>
              ) : "开始练习"}
            </button>
          </div>

          {error ? <p className="inline-error">{error}</p> : null}
        </section>
      ) : null}

      {screen === "practice" && scenario ? (
        <section className="practice-screen">
          <button className="plain-back" onClick={resetToSetup} type="button">
            <ArrowLeft size={16} aria-hidden="true" />
            换难度
          </button>

          <div className="micro-scenario">
            <span className="scenario-badge">{getDifficultyLabel(scenario.difficulty)}</span>
            <p>{scenario.promptZh}</p>
          </div>

          <div className="scenario-context">
            <div className="context-chip">
              <span>场合</span>
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
              handleSubmit();
            }}
          >
            <HintRow hints={scenario.wordHints ?? []} />
            <textarea
              autoFocus
              disabled={isScoring}
              onKeyDown={handleAnswerKeyDown}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="用英文回应，像真的在对话…"
              ref={textareaRef}
              rows={6}
              spellCheck={false}
              value={answer}
            />
            {isScoring ? (
              <div className="scoring-overlay">
                <span className="spinner" aria-hidden="true" />
                评分中…
              </div>
            ) : null}
            <div className="practice-footer">
              <span className="shortcut-hint">Enter 提交 · Ctrl+空格 换行</span>
              <button
                className="start-button"
                disabled={isScoring || !answer.trim()}
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
              <span className="result-score-label">口语自然度</span>
              <div className="compact-metrics">
                {scoreLabels.map(({ key, label }) => {
                  const value = result[key];
                  return typeof value === "number" ? (
                    <div key={key} className="metric-cell">
                      <span>{label}</span>
                      <strong>{Math.round(value)}</strong>
                      <div className="metric-mini-bar"><div style={{ width: `${value}%` }} /></div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>

          <div className="result-compare">
            <div className="result-compare-col">
              <span className="result-col-label">你的回答</span>
              <p className="user-answer-text">{submittedAnswer}</p>
            </div>
            <div className="result-compare-col result-compare-col--better">
              <span className="result-col-label">更地道的说法</span>
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
            </div>
          </div>

          <div className="result-detail-grid">
            <div className="result-block">
              <h2>反馈</h2>
              <p>{result.feedbackZh}</p>
            </div>
            <div className="result-block">
              <h2>为什么更本土</h2>
              <p>{result.whyBetterZh}</p>
            </div>
            {result.alternatives.length > 0 && (
              <div className="result-block result-block--full">
                <h2>其他说法</h2>
                <ul>
                  {result.alternatives.map((alt) => (
                    <li key={alt}><VocabText text={alt} example={alt} /></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="result-actions">
            <button className="secondary-button" onClick={resetToSetup} type="button">
              换难度
            </button>
            <button
              className="start-button"
              disabled={isGenerating || isPrefetching}
              onClick={handleNextCachedScenario}
              type="button"
            >
              <RotateCcw size={16} aria-hidden="true" />
              {isPrefetching || isGenerating ? "准备中…" : "再来一句"}
            </button>
          </div>

          {error ? <p className="inline-error">{error}</p> : null}
        </section>
      ) : null}

      <SettingsModal
        open={isSettingsOpen}
        settings={settings}
        hasServerKey={hasServerKey}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      {showAdminPrompt && (
        <AdminPrompt
          onSuccess={() => {
            sessionStorage.setItem("admin-unlocked", "1");
            setAdminUnlocked(true);
            setShowAdminPrompt(false);
            setIsSettingsOpen(true);
          }}
          onClose={() => setShowAdminPrompt(false)}
        />
      )}

      {isInsightOpen ? (
        <InsightPanel
          insight={insight}
          isAnalyzing={isAnalyzing}
          onClose={() => setIsInsightOpen(false)}
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
      <div className="insight-modal" onClick={(e) => e.stopPropagation()}>
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
              再练 {ANALYZE_EVERY - (insight.totalAttempts % ANALYZE_EVERY)} 次后生成第一份分析报告。
            </p>
          )}

          {latest && (
            <>
              <div className="insight-section">
                <h3>当前弱项</h3>
                <ul>
                  {latest.weaknesses.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
              <div className="insight-section">
                <h3>词汇问题</h3>
                <ul>
                  {latest.vocabularyIssues.map((v) => <li key={v}>{v}</li>)}
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
                  <h3>第一次报告（{first.attemptCount} 次练习时）</h3>
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
  if (hints.length === 0) return null;
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
    case "beginner": return "短句、直接、先像人话";
    case "intermediate": return "语气更自然，有一点情绪";
    case "advanced": return "更本土、更有态度、更像真实关系";
  }
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function AdminPrompt({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "密码错误。");
      }
    } catch {
      setError("验证失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="admin-prompt" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h2>管理员验证</h2>
          <input
            autoFocus
            type="password"
            placeholder="输入管理员密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="admin-error">{error}</p>}
          <div className="admin-actions">
            <button type="button" className="secondary-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button" disabled={loading || !password}>
              {loading ? "验证中…" : "确认"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
